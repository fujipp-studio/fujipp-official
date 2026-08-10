import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Interaction,
  type Message,
  MessageFlags,
} from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";
import { downloadImage, preprocessImage } from "./image-processor.js";
import {
  extractPrices,
  lookupShopPrice,
  readPriceMap,
  type PriceEntry,
} from "./price-extractor.js";

// ── Tesseract lazy singleton ────────────────────────────────────────────────

interface TesseractWorker {
  recognize(image: Buffer | string): Promise<{ data: { text: string } }>;
  terminate(): Promise<void>;
}

let workerPromise: Promise<TesseractWorker> | undefined;

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Tesseract = await import("tesseract.js" as string) as { createWorker(langs: string[]): Promise<TesseractWorker> };
      const worker = await Tesseract.createWorker(["tha", "eng"]);
      return worker;
    })();
  }
  return workerPromise;
}

async function terminateWorker(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    workerPromise = undefined;
    await worker.terminate();
  }
}

// ── Feature module ──────────────────────────────────────────────────────────

export const priceReaderFeature: FeatureModule = {
  runtimeKey: "price-reader",
  version: "1.0.0",
  intents: ["Guilds", "GuildMessages", "MessageContent"],

  async activate(context) {
    const channelId = requiredSnowflake(context.config.PRICE_READER_CHANNEL_ID, "PRICE_READER_CHANNEL_ID");
    const orderChannelId = optionalSnowflake(context.config.PRICE_READER_ORDER_CHANNEL_ID, "PRICE_READER_ORDER_CHANNEL_ID");
    const priceMap = readPriceMap(context.config.PRICE_READER_PRICE_MAP);
    const noNitroMarkupSatang = numberConfig(context.config.PRICE_READER_NO_NITRO_MARKUP_SATANG, 1_000);
    let queue = Promise.resolve();
    let stopped = false;

    const enqueue = (message: Message) => {
      if (stopped) return;
      if (message.author.bot || message.channelId !== channelId) return;

      const images = [...message.attachments.values()].filter(
        (a) => a.contentType?.startsWith("image/"),
      );
      if (images.length === 0) return;

      queue = queue
        .then(() => processImages(context, message, images, priceMap, noNitroMarkupSatang, orderChannelId))
        .catch(logError(context, "image processing"));
    };

    context.client.on("messageCreate", enqueue);

    console.info(`Price Reader active: bot ${context.botId}, channel ${channelId}, price entries ${priceMap.length}`);

    return async () => {
      stopped = true;
      context.client.off("messageCreate", enqueue);
      await queue;
      await terminateWorker();
    };
  },
};

// ── Core processing ─────────────────────────────────────────────────────────

async function processImages(
  context: FeatureContext,
  message: Message,
  attachments: import("discord.js").Attachment[],
  priceMap: PriceEntry[],
  noNitroMarkupSatang: number,
  orderChannelId: string | undefined,
): Promise<void> {
  const processing = await message.reply(
    render(context, "processing", { image_count: String(attachments.length) }),
  );

  const perImageResults: Record<string, string>[] = [];

  for (const attachment of attachments) {
    try {
      const raw = await downloadImage(attachment.url);
      const processed = await preprocessImage(raw);
      const worker = await getWorker();
      const { data } = await worker.recognize(processed);
      const prices = extractPrices(data.text);

      if (!prices.currentPriceSatang) {
        perImageResults.push({ status: "error", error_message: "ไม่สามารถอ่านราคาจากรูปนี้ได้ กรุณาลองส่งรูปที่ชัดกว่านี้" });
        continue;
      }

      const discordPriceSatang = prices.currentPriceSatang;
      const shopPriceSatang = lookupShopPrice(discordPriceSatang, priceMap);

      perImageResults.push({
        status: "success",
        item_name: prices.itemName ?? "",
        discord_price: money(discordPriceSatang),
        original_price: prices.originalPriceSatang ? money(prices.originalPriceSatang) : "",
        nitro_price: prices.nitroPriceSatang ? money(prices.nitroPriceSatang) : "",
        discount_percent: prices.discountPercent ? String(prices.discountPercent) : "",
        shop_price: shopPriceSatang !== null ? money(shopPriceSatang) : "",
        shop_price_found: shopPriceSatang !== null ? "true" : "false",
        no_nitro_markup: money(noNitroMarkupSatang),
      });
    } catch (error) {
      console.error(`Price Reader OCR failed for attachment ${attachment.id}:`, error);
      perImageResults.push({ status: "error", error_message: errorMessage(error) });
    }
  }

  // Build template variables for the combined result.
  const successResults = perImageResults.filter((r) => r.status === "success");
  if (successResults.length === 0) {
    const messages = perImageResults
      .map((result) => result.error_message)
      .filter((message): message is string => Boolean(message));
    await processing.edit(defaultErrorRender(messages));
    return;
  }

  const orderUrl = orderChannelId && context.guildId
    ? `https://discord.com/channels/${context.guildId}/${orderChannelId}`
    : "";

  // If presentations provide a custom layout, use that. Otherwise build a
  // default embed with all results.
  const vars: Record<string, string> = {
    image_count: String(attachments.length),
    success_count: String(successResults.length),
    error_count: String(perImageResults.length - successResults.length),
    order_url: orderUrl,
    no_nitro_markup: money(noNitroMarkupSatang),
    // First result variables (for single-image use-case).
    ...(successResults[0] ?? {}),
  };

  // Build the results section for default rendering.
  const resultItemTemplate = typeof context.config.PRICE_READER_RESULTS_ITEM_TEMPLATE === "string"
    ? context.config.PRICE_READER_RESULTS_ITEM_TEMPLATE
    : "### รูปที่ {{result_index}}\n💙 **ราคาดิสคอร์ด**\n`{{discord_price}} บาท`{{discount_text}}\n💗 **ราคาร้านขาย**\n`{{shop_price_text}}`\n💛 **ราคาไม่มีไนโตร บวกชิ้นละ**\n`{{no_nitro_markup}} บาท`";
  const sections = perImageResults.map((r, index) => {
    if (r.status === "error") {
      return `### รูปที่ ${index + 1}\n❌ ${r.error_message ?? "เกิดข้อผิดพลาด"}`;
    }
    const discountTag = r.discount_percent ? ` (ลด ${r.discount_percent}%)` : "";
    return replace(resultItemTemplate, {
      ...r,
      result_index: String(index + 1),
      discount_text: discountTag,
      shop_price_text: r.shop_price_found === "true" ? `${r.shop_price} บาท` : "ไม่พบราคาที่ตรงกัน",
    });
  });
  vars.results_text = sections.join("\n\n---\n\n");

  const payload = render(context, "result", vars);

  // Append the order button if not already handled by presentations.
  if (orderUrl && !hasPresentation(context, "result")) {
    const button = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(orderUrl)
      .setLabel("สั่งซื้อคลิก")
      .setEmoji("🍃");
    const existing = Array.isArray(payload.components) ? payload.components : [];
    payload.components = [...existing, new ActionRowBuilder<ButtonBuilder>().addComponents(button).toJSON()];
  }

  await processing.edit(payload);
}

// ── Presentations renderer ──────────────────────────────────────────────────
// Mirrors the wallet-topup rendering system so shop owners can fully customise
// the bot's responses via the dashboard presentations editor.

function render(
  context: FeatureContext,
  slot: string,
  values: Record<string, string>,
): Record<string, unknown> {
  const raw = isRecord(context.presentations[slot]) ? context.presentations[slot] : undefined;

  if (!raw) return defaultRender(slot, values);

  // ── Components V2 mode ──────────────────────────────────────────────────
  if (raw.mode === "COMPONENTS_V2" && Array.isArray(raw.components)) {
    return {
      flags: MessageFlags.IsComponentsV2,
      components: deepRender(raw.components, values),
    };
  }

  // ── Embed mode ──────────────────────────────────────────────────────────
  if (raw.mode === "EMBED" && Array.isArray(raw.embeds)) {
    return {
      content: typeof raw.content === "string" ? replace(raw.content, values) : null,
      embeds: deepRender(raw.embeds, values),
      components: Array.isArray(raw.components) ? deepRender(raw.components, values) : [],
    };
  }

  // ── Simple mode (title + description + optional links) ─────────────────
  const title = replace(String(raw.title ?? ""), values);
  const description = replace(String(raw.description ?? ""), values);
  const buttons: ButtonBuilder[] = [];

  if (Array.isArray(raw.links)) {
    for (const item of raw.links) {
      if (!isRecord(item)) continue;
      const url = replace(String(item.url ?? ""), values);
      if (!url) continue;
      buttons.push(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL(url)
          .setLabel(replace(String(item.label ?? "เปิดลิงก์"), values))
          .setEmoji(replace(String(item.emoji ?? "🔗"), values)),
      );
    }
  }

  const row = buttons.length
    ? new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
    : undefined;

  if (raw.mode === "EMBED") {
    return {
      embeds: [{
        title,
        description,
        image: urlObject(replace(String(raw.image_url ?? ""), values)),
        thumbnail: urlObject(replace(String(raw.thumbnail_url ?? ""), values)),
        color: typeof raw.color === "number" ? raw.color : 0x5865F2,
      }],
      components: row ? [row] : [],
    };
  }

  // Components V2 fallback.
  const parts: unknown[] = [
    { type: 10, content: `# ${title}\n` },
    { type: 14, divider: true, spacing: 2 },
    { type: 10, content: description },
  ];
  const image = replace(String(raw.image_url ?? ""), values);
  if (image) parts.push({ type: 12, items: [{ media: { url: image } }] });
  if (row) parts.push(row.toJSON());

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{ type: 17, components: parts }],
  };
}

/** Returns true if the presentations object has a custom template for the slot. */
function hasPresentation(context: FeatureContext, slot: string): boolean {
  return isRecord(context.presentations[slot]);
}

/** Default rendering when no presentation is configured. */
function defaultRender(slot: string, values: Record<string, string>): Record<string, unknown> {
  if (slot === "processing") {
    return { content: `⏳ กำลังอ่านราคาจากรูป... (${values.image_count ?? "?"} รูป)` };
  }

  // ── Default result embed ────────────────────────────────────────────────
  const header = `💗 **ผลการอ่าน ( จำนวน ${values.image_count ?? "?"} รูป )**`;
  const body = values.results_text ?? "";
  const footer = "🟡 🟢 🩷 🟣 🔵 🩷 🔴 🟡 🟢 🔵 🔴 🩷 🟡 🟣 🔵 🟢 🔴 🩷 🟡 🟣";

  return {
    content: null,
    embeds: [{
      description: `${header}\n\n${body}`,
      color: 0x5865F2,
      footer: { text: footer },
    }],
    components: [],
  };
}

function defaultErrorRender(messages: string[]): Record<string, unknown> {
  const description = messages.length > 0
    ? messages.map((message) => `❌ ${message}`).join("\n")
    : "❌ ไม่สามารถอ่านราคาจากรูปนี้ได้ กรุณาลองส่งรูปที่ชัดกว่านี้";
  return {
    content: null,
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      components: [{ type: 10, content: description }],
    }],
  };
}

// ── Template helpers ────────────────────────────────────────────────────────

function replace(v: string, vars: Record<string, string>): string {
  return v.replace(/\{\{([a-z0-9_]+)}}/gi, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

function deepRender(value: unknown, values: Record<string, string>): unknown {
  if (typeof value === "string") return replace(value, values);
  if (Array.isArray(value)) return value.map((item) => deepRender(item, values));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepRender(item, values)]),
    );
  }
  return value;
}

function urlObject(url: string): { url: string } | undefined {
  return url ? { url } : undefined;
}

// ── Utilities ───────────────────────────────────────────────────────────────

function money(satang: number): string {
  return (satang / 100).toFixed(2);
}

function requiredSnowflake(value: unknown, key: string): string {
  const snowflake = optionalSnowflake(value, key);
  if (!snowflake) throw new Error(`${key} is required`);
  return snowflake;
}

function optionalSnowflake(value: unknown, key: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{15,30}$/.test(value)) throw new Error(`${key} is invalid`);
  return value;
}

function numberConfig(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isSafeInteger(v) ? v : fallback;
}

function logError(context: FeatureContext, operation: string): (error: unknown) => void {
  return (error) => console.error(`Price Reader ${operation} failed for bot ${context.botId}: ${errorMessage(error)}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
