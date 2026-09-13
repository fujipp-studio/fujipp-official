import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type GuildTextBasedChannel,
  type Interaction,
  type Message,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";

const ACTION_PREFIX = "fujipp:payment:";
const MAX_AMOUNT_SATANG = 100_000_000;

type PaymentMethod = "bank" | "wallet";
type ParsedTrigger =
  | { kind: "ignore" }
  | { kind: "invalid" }
  | { kind: "payment"; amountSatang: number };

export const paymentTriggerFeature: FeatureModule = {
  runtimeKey: "payment-trigger",
  version: "1.0.0",
  intents: ["Guilds", "GuildMessages", "MessageContent"],
  async activate(context) {
    const onMessageCreate = (message: Message) => {
      void handlePaymentTrigger(context, message).catch((error) => {
        console.error(
          `Payment trigger failed for bot ${context.botId}: ${errorMessage(error)}`,
        );
        void context.reportFeatureError("PAYMENT_TRIGGER_FAILED", error);
      });
    };
    const onInteractionCreate = (interaction: Interaction) => {
      if (
        !interaction.isButton() ||
        !interaction.customId.startsWith(ACTION_PREFIX)
      )
        return;
      void handlePaymentMethod(context, interaction).catch((error) => {
        console.error(
          `Payment method selection failed for bot ${context.botId}: ${errorMessage(error)}`,
        );
        void context.reportFeatureError(
          "PAYMENT_METHOD_SELECTION_FAILED",
          error,
        );
        void respondInteractionError(interaction);
      });
    };

    context.client.on("messageCreate", onMessageCreate);
    context.client.on("interactionCreate", onInteractionCreate);
    return () => {
      context.client.off("messageCreate", onMessageCreate);
      context.client.off("interactionCreate", onInteractionCreate);
    };
  },
};

async function handlePaymentTrigger(
  context: FeatureContext,
  message: Message,
): Promise<void> {
  if (!message.inGuild() || message.author.bot) return;
  if (context.guildId && message.guildId !== context.guildId) return;
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator))
    return;
  if (!isSendableGuildChannel(message.channel)) return;

  const parsed = parseTrigger(
    message.content,
    stringConfig(context.config.PAYMENT_TRIGGER_PREFIX, "p"),
  );
  if (parsed.kind === "ignore") return;
  await message.delete().catch((error) => {
    console.warn(
      `Unable to delete payment trigger message ${message.id}: ${errorMessage(error)}`,
    );
  });

  const variables = baseVariables(
    context,
    parsed.kind === "payment" ? parsed.amountSatang : 0,
  );
  await message.channel.send(
    renderPresentation(
      context,
      parsed.kind === "payment" ? "method_selector" : "invalid_amount",
      variables,
      parsed.kind === "payment" ? parsed.amountSatang : undefined,
    ),
  );
}

async function handlePaymentMethod(
  context: FeatureContext,
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;
  if (context.guildId && interaction.guildId !== context.guildId) return;
  const action = parseAction(interaction.customId);
  if (!action) return;
  const slot = action.method === "bank" ? "bank_payment" : "wallet_payment";
  await interaction.update(
    renderPresentation(
      context,
      slot,
      baseVariables(context, action.amountSatang),
    ) as never,
  );
}

function parseTrigger(
  content: string,
  configuredPrefix: string,
): ParsedTrigger {
  const prefix = configuredPrefix.trim().toLocaleLowerCase("en-US");
  if (!prefix) return { kind: "ignore" };
  const normalized = content.trim().toLocaleLowerCase("en-US");
  if (normalized === prefix) return { kind: "invalid" };
  if (!normalized.startsWith(prefix)) return { kind: "ignore" };
  const amountText = normalized.slice(prefix.length);
  if (!/^[0-9]/.test(amountText)) return { kind: "ignore" };
  const amountSatang = parseAmountSatang(amountText);
  return amountSatang === null
    ? { kind: "invalid" }
    : { kind: "payment", amountSatang };
}

function parseAmountSatang(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [baht, decimals = ""] = value.split(".");
  const amountSatang = Number(baht) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(amountSatang) &&
    amountSatang > 0 &&
    amountSatang <= MAX_AMOUNT_SATANG
    ? amountSatang
    : null;
}

function parseAction(
  customId: string,
): { method: PaymentMethod; amountSatang: number } | null {
  const match = customId.match(/^fujipp:payment:(bank|wallet):(\d+)$/);
  if (!match) return null;
  const amountSatang = Number(match[2]);
  return Number.isSafeInteger(amountSatang) &&
    amountSatang > 0 &&
    amountSatang <= MAX_AMOUNT_SATANG
    ? { method: match[1] as PaymentMethod, amountSatang }
    : null;
}

function baseVariables(
  context: FeatureContext,
  amountSatang: number,
): Record<string, string> {
  const feeSatang = integerConfig(context.config.WALLET_FEE_SATANG, 500);
  return {
    amount: money(amountSatang),
    base_amount: money(amountSatang),
    fee_amount: money(feeSatang),
    total_amount: money(amountSatang + feeSatang),
    qr_image_url: stringConfig(context.config.BANK_QR_IMAGE_URL, ""),
    wallet_number: stringConfig(context.config.WALLET_NUMBER, ""),
    trigger: stringConfig(context.config.PAYMENT_TRIGGER_PREFIX, "p"),
    datetime: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
  };
}

function renderPresentation(
  context: FeatureContext,
  slot: string,
  variables: Record<string, string>,
  selectorAmountSatang?: number,
): Record<string, unknown> {
  const definition = isRecord(context.presentations[slot])
    ? context.presentations[slot]
    : null;
  if (!definition) throw new Error(`Presentation ${slot} is not configured`);
  const mode = String(definition.mode ?? "COMPONENTS_V2").toUpperCase();
  const actions =
    selectorAmountSatang === undefined
      ? []
      : paymentButtons(definition, selectorAmountSatang);

  if (mode === "COMPONENTS_V2") {
    const source = isRecord(definition.components_v2)
      ? definition.components_v2
      : definition;
    if (!Array.isArray(source.components))
      throw new Error(`Presentation ${slot} must contain Components V2 blocks`);
    const components = normalizeComponentColors(
      deepRender(source.components, variables),
    );
    if (actions.length)
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(actions).toJSON(),
      );
    return {
      flags: MessageFlags.IsComponentsV2,
      components,
      allowedMentions: { parse: [] },
    };
  }

  const source = isRecord(definition.embed) ? definition.embed : definition;
  const embed = deepRender(source, variables) as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    embeds: [normalizeEmbed(embed)],
    allowedMentions: { parse: [] },
  };
  if (actions.length)
    payload.components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(actions).toJSON(),
    ];
  return payload;
}

function paymentButtons(
  definition: Record<string, unknown>,
  amountSatang: number,
): ButtonBuilder[] {
  const configured = isRecord(definition.components)
    ? definition.components
    : {};
  return [
    configuredButton(
      configured.bank_button,
      `${ACTION_PREFIX}bank:${amountSatang}`,
      "สแกน QR ธนาคาร",
      "🏦",
      ButtonStyle.Success,
    ),
    configuredButton(
      configured.wallet_button,
      `${ACTION_PREFIX}wallet:${amountSatang}`,
      "ชำระผ่าน Wallet",
      "🟠",
      ButtonStyle.Primary,
    ),
  ];
}

function configuredButton(
  value: unknown,
  customId: string,
  fallbackLabel: string,
  fallbackEmoji: string,
  fallbackStyle: ButtonStyle,
): ButtonBuilder {
  const config = isRecord(value) ? value : {};
  const styles: Record<string, ButtonStyle> = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
  };
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(String(config.label ?? fallbackLabel).slice(0, 80))
    .setStyle(
      styles[String(config.style ?? "").toLowerCase()] ?? fallbackStyle,
    );
  const emoji = String(config.emoji ?? fallbackEmoji).trim();
  if (emoji)
    try {
      button.setEmoji(emoji);
    } catch {
      /* Invalid configured emoji is omitted. */
    }
  return button;
}

function normalizeEmbed(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...value };
  if (typeof next.color === "string" && /^#?[0-9a-f]{6}$/i.test(next.color)) {
    next.color = Number.parseInt(next.color.replace(/^#/, ""), 16);
  }
  if (typeof next.image_url === "string") {
    if (/^https?:\/\//i.test(next.image_url))
      next.image = { url: next.image_url };
    delete next.image_url;
  }
  return next;
}

function deepRender(
  value: unknown,
  variables: Record<string, string>,
): unknown {
  if (typeof value === "string") return fill(value, variables);
  if (Array.isArray(value))
    return value.map((item) => deepRender(item, variables));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        deepRender(item, variables),
      ]),
    );
  }
  return value;
}

function normalizeComponentColors(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!isRecord(item)) return item;
    const next = { ...item };
    if (
      next.type === 17 &&
      typeof next.accent_color === "string" &&
      /^#[0-9a-f]{6}$/i.test(next.accent_color)
    ) {
      next.accent_color = Number.parseInt(next.accent_color.slice(1), 16);
    }
    if (Array.isArray(next.components))
      next.components = normalizeComponentColors(next.components);
    return next;
  });
}

function money(amountSatang: number): string {
  return (amountSatang / 100).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function fill(value: string, variables: Record<string, string>): string {
  return value.replace(
    /\{\{([a-z0-9_]+)}}/gi,
    (_, key: string) => variables[key] ?? "",
  );
}

function stringConfig(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function integerConfig(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

function isSendableGuildChannel(
  channel: unknown,
): channel is GuildTextBasedChannel {
  return (
    !!channel &&
    typeof channel === "object" &&
    "isTextBased" in channel &&
    typeof channel.isTextBased === "function" &&
    channel.isTextBased() &&
    "send" in channel &&
    typeof channel.send === "function" &&
    "guildId" in channel
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
}

async function respondInteractionError(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.isRepliable()) return;
  const content = "ไม่สามารถแสดงข้อมูลการชำระเงินได้ กรุณาลองใหม่อีกครั้ง";
  if (interaction.deferred || interaction.replied) {
    await interaction
      .followUp({ content, flags: MessageFlags.Ephemeral })
      .catch(() => undefined);
  } else {
    await interaction
      .reply({ content, flags: MessageFlags.Ephemeral })
      .catch(() => undefined);
  }
}

export { parseAction, parseAmountSatang, parseTrigger };
