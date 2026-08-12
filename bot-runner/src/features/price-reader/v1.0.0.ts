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

interface PriceReaderVersionOptions {
  version: string;
  extract: typeof extractPrices;
  showNoNitroMarkup: boolean;
}

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

export function createPriceReaderFeature(options: PriceReaderVersionOptions): FeatureModule {
  return {
    runtimeKey: "price-reader",
    version: options.version,
    intents: ["Guilds", "GuildMessages", "MessageContent"],

    async activate(context) {
      const channelId = requiredSnowflake(context.config.PRICE_READER_CHANNEL_ID, "PRICE_READER_CHANNEL_ID");
      const orderChannelId = optionalSnowflake(context.config.PRICE_READER_ORDER_CHANNEL_ID, "PRICE_READER_ORDER_CHANNEL_ID");
      const priceMap = readPriceMap(context.config.PRICE_READER_PRICE_MAP);
      const noNitroMarkupSatang = options.showNoNitroMarkup
        ? numberConfig(context.config.PRICE_READER_NO_NITRO_MARKUP_SATANG, 1_000)
        : undefined;
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
          .then(() => processImages(context, message, images, priceMap, noNitroMarkupSatang, orderChannelId, options.extract))
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
}

export const priceReaderFeature = createPriceReaderFeature({
  version: "1.0.0",
  extract: extractPrices,
  showNoNitroMarkup: true,
});

// ── Core processing ─────────────────────────────────────────────────────────

async function processImages(
  context: FeatureContext,
  message: Message,
  attachments: import("discord.js").Attachment[],
  priceMap: PriceEntry[],
  noNitroMarkupSatang: number | undefined,
  orderChannelId: string | undefined,
  extract: typeof extractPrices,
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
      const prices = extract(data.text);

      if (!prices.currentPriceSatang) {
        perImageResults.push({
          status: "error",
          error_message: "ไม่พบราคาที่รองรับในรูปนี้ กรุณาตรวจสอบว่ารูปมีราคาเป็นเงินบาทและลองส่งอีกครั้ง",
        });
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
        ...(noNitroMarkupSatang === undefined ? {} : { no_nitro_markup: money(noNitroMarkupSatang) }),
      });
    } catch (error) {
      console.error(`Price Reader OCR failed for attachment ${attachment.id}:`, error);
      perImageResults.push({
        status: "error",
        error_message: "เกิดข้อผิดพลาดขณะอ่านรูป กรุณาลองส่งรูปอีกครั้ง",
      });
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
    ...(noNitroMarkupSatang === undefined ? {} : { no_nitro_markup: money(noNitroMarkupSatang) }),
    // First result variables (for single-image use-case).
    ...(successResults[0] ?? {}),
  };

  // Build the results section for default rendering.
  const resultItemTemplate = typeof context.config.PRICE_READER_RESULTS_ITEM_TEMPLATE === "string"
    ? context.config.PRICE_READER_RESULTS_ITEM_TEMPLATE
    : noNitroMarkupSatang === undefined
      ? "### รูปที่ {{result_index}}\n💙 **ราคาดิสคอร์ด**\n`{{discord_price}} บาท`\n💗 **ราคาร้านขาย**\n`{{shop_price_text}}`"
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
  const mode = String(raw.mode ?? "EMBED").toUpperCase();
  const nested = mode === "EMBED" && isRecord(raw.embed)
    ? raw.embed
    : mode === "COMPONENTS_V2" && isRecord(raw.components_v2)
      ? raw.components_v2
      : {};
  const definition = { ...raw, ...nested };
  const linkButtons: ButtonBuilder[] = [];
  if (Array.isArray(definition.links)) {
    for (const item of definition.links) {
      if (!isRecord(item)) continue;
      const url = replace(String(item.url ?? ""), values);
      if (!/^https?:\/\//i.test(url)) continue;
      const button = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(url)
        .setLabel(replace(String(item.label ?? "เปิดลิงก์"), values).slice(0, 80));
      const emoji = replace(String(item.emoji ?? "🔗"), values);
      if (emoji) button.setEmoji(emoji);
      linkButtons.push(button);
    }
  }
  const linkRow = linkButtons.length
    ? new ActionRowBuilder<ButtonBuilder>().addComponents(linkButtons.slice(0, 5)).toJSON()
    : undefined;

  // ── Components V2 mode ──────────────────────────────────────────────────
  if (mode === "COMPONENTS_V2" && Array.isArray(definition.components)) {
    const components = normalizeComponentColors(deepRender(definition.components, values));
    if (linkRow) components.push(linkRow);
    return {
      flags: MessageFlags.IsComponentsV2,
      components,
    };
  }

  // ── Simple mode (title + description + optional links) ─────────────────
  const title = replace(String(definition.title ?? ""), values);
  const description = replace(String(definition.description ?? ""), values);

  if (mode === "EMBED") {
    if (Array.isArray(definition.embeds)) return {
      content: typeof definition.content === "string" ? replace(definition.content, values) : undefined,
      embeds: deepRender(definition.embeds, values),
      components: linkRow ? [linkRow] : [],
    };
    const footer = isRecord(definition.footer)
      ? deepRender(definition.footer, values)
      : definition.footer
        ? { text: replace(String(definition.footer), values) }
        : undefined;
    return {
      content: typeof definition.content === "string" ? replace(definition.content, values) : undefined,
      embeds: [{
        title,
        url: optionalUrl(definition.url, values),
        description,
        author: isRecord(definition.author) ? deepRender(definition.author, values) : undefined,
        fields: Array.isArray(definition.fields) ? deepRender(definition.fields, values) : [],
        footer,
        timestamp: definition.timestamp === true ? new Date().toISOString() : definition.timestamp || undefined,
        image: urlObject(readImageUrl(definition.image_url ?? definition.image, values)),
        thumbnail: urlObject(readImageUrl(definition.thumbnail_url ?? definition.thumbnail, values)),
        color: embedColor(definition.color) ?? 0x5865F2,
      }],
      components: linkRow ? [linkRow] : [],
    };
  }

  // Components V2 fallback.
  const parts: unknown[] = [
    { type: 10, content: `# ${title}\n` },
    { type: 14, divider: true, spacing: 2 },
    { type: 10, content: description },
  ];
  const image = readImageUrl(definition.image_url ?? definition.image, values);
  if (image) parts.push({ type: 12, items: [{ media: { url: image } }] });
  if (linkRow) parts.push(linkRow);

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{ type: 17, components: parts }],
  };
}

function normalizeComponentColors(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!isRecord(item)) return item;
    const next = { ...item };
    if (next.type === 17 && typeof next.accent_color === "string" && /^#[0-9a-f]{6}$/i.test(next.accent_color)) {
      next.accent_color = Number.parseInt(next.accent_color.slice(1), 16);
    }
    if (Array.isArray(next.components)) next.components = normalizeComponentColors(next.components);
    return next;
  });
}

function embedColor(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffffff) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized, 16) : undefined;
}

function readImageUrl(value: unknown, values: Record<string, string>): string {
  if (typeof value === "string") return replace(value, values);
  return isRecord(value) ? replace(String(value.url ?? ""), values) : "";
}

function optionalUrl(value: unknown, values: Record<string, string>): string | undefined {
  const url = replace(String(value ?? ""), values);
  return /^https?:\/\//i.test(url) ? url : undefined;
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
    : "❌ ไม่พบราคาที่รองรับในรูปนี้ กรุณาตรวจสอบว่ารูปมีราคาเป็นเงินบาทและลองส่งอีกครั้ง";
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
