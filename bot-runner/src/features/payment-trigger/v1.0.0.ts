import { featureErrorPayload, replyFeatureError } from "../errors.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type GuildTextBasedChannel,
  type Interaction,
  type Message,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
  type APIMessageComponentEmoji,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";

const ACTION_PREFIX = "fujipp:payment:";
const VOUCHER_MODAL_PREFIX = `${ACTION_PREFIX}redeem:`;
const MAX_AMOUNT_SATANG = 100_000_000;

type PaymentMethod = "bank" | "wallet";
type PaymentContext = FeatureContext & { navigation?: boolean };
type ResponseMode = "UPDATE" | "NEW_MESSAGE";
type NavigationAction = { method: "bank" | "wallet" | "back" | "voucher" | "redeem";
  amountSatang: number; messageId: string; responseMode: ResponseMode };
const NAVIGATION_PREFIX = `${ACTION_PREFIX}v11:`;
type ParsedTrigger =
  | { kind: "ignore" }
  | { kind: "invalid" }
  | { kind: "payment"; amountSatang: number };

export const paymentTriggerFeature = createPaymentTriggerFeature("1.0.0");

export function createPaymentTriggerFeature(version: string, navigation = false): FeatureModule {
  return {
    runtimeKey: "payment-trigger",
    version,
    intents: ["Guilds", "GuildMessages", "MessageContent"],
    async activate(baseContext) {
      const context: PaymentContext = { ...baseContext, navigation };
      const onMessageCreate = (message: Message) => {
        void handlePaymentTrigger(context, message).catch((error) => {
          console.error(
            `Payment trigger failed for bot ${context.botId}: ${errorMessage(error)}`,
          );
          void context.reportFeatureError("PAYMENT_TRIGGER_FAILED", error, { recoverable: true }).catch(() => undefined);
          if (isSendableGuildChannel(message.channel)) void message.channel.send(featureErrorPayload("payment-trigger", error, { code: "PAYMENT_TRIGGER_FAILED" })).catch(() => undefined);
        });
      };
      const onInteractionCreate = (interaction: Interaction) => {
        if (!interaction.isButton() && interaction.isModalSubmit() && (interaction.customId.startsWith(VOUCHER_MODAL_PREFIX) || (navigation && interaction.customId.startsWith(`${NAVIGATION_PREFIX}redeem:`)))) {
          void handlePaymentVoucher(context, interaction).catch((error) => {
            void context.reportFeatureError("PAYMENT_VOUCHER_FAILED", error, { recoverable: true }).catch(() => undefined);
            void replyFeatureError(interaction, "payment-trigger", error, { code: "PAYMENT_VOUCHER_FAILED",
              hint: "ตรวจสอบยอดและสถานะรายการก่อนชำระซ้ำ หากผลไม่ชัดเจนให้ติดต่อผู้ดูแลร้าน" });
          });
          return;
        }
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
            { recoverable: true },
          ).catch(() => undefined);
          void replyFeatureError(interaction, "payment-trigger", context.navigation ? error : "ไม่สามารถแสดงข้อมูลการชำระเงินได้ กรุณาลองใหม่อีกครั้ง", { code: "PAYMENT_METHOD_SELECTION_FAILED", followUp: true });
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
}

async function handlePaymentTrigger(
  context: PaymentContext,
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
      message.id,
    ),
  );
}

async function handlePaymentMethod(
  context: PaymentContext,
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;
  if (context.guildId && interaction.guildId !== context.guildId) return;
  const navigation = context.navigation ? parseNavigationAction(interaction.customId) : null;
  const voucher = navigation?.method === "voucher" ? navigation : parseVoucherAction(interaction.customId, "voucher");
  if (voucher) {
    if (context.config.TRUEMONEY_ENABLED !== true) throw new Error("ร้านยังไม่เปิดรับชำระด้วยซองอั่งเปา");
    const input = new TextInputBuilder().setCustomId("gift_url").setLabel(`ลิงก์ซองอั่งเปา ${money(voucher.amountSatang)} บาท`)
      .setStyle(TextInputStyle.Short).setPlaceholder("https://gift.truemoney.com/campaign/?v=...")
      .setRequired(true).setMaxLength(500);
    await interaction.showModal(new ModalBuilder().setCustomId(navigation ? navigationId({ ...navigation, method: "redeem" }) : `${VOUCHER_MODAL_PREFIX}${voucher.amountSatang}:${voucher.messageId}`)
      .setTitle("ชำระเงินด้วยซองอั่งเปา").addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input)));
    return;
  }
  if (navigation && navigation.method !== "redeem") {
    const slot = navigation.method === "back" ? "method_selector" : navigation.method === "bank" ? "bank_payment" : "wallet_payment";
    const payload = renderPresentation(context, slot, baseVariables(context, navigation.amountSatang), navigation.amountSatang, navigation.messageId);
    if (navigation.responseMode === "UPDATE") {
      assertCanUpdate(interaction.message, payload);
      await interaction.deferUpdate();
      await interaction.editReply(updatePayload(payload) as never);
    } else {
      await interaction.deferReply();
      try { await interaction.editReply(payload as never); }
      catch (error) { await interaction.deleteReply().catch(() => undefined); throw error; }
    }
    return;
  }
  const action = parseAction(interaction.customId);
  if (!action) return;
  const slot = action.method === "bank" ? "bank_payment" : "wallet_payment";
  await interaction.update(
    renderPresentation(
      context,
      slot,
      baseVariables(context, action.amountSatang),
      context.navigation ? action.amountSatang : undefined,
      context.navigation ? originalInvoiceId(interaction.message) : undefined,
    ) as never,
  );
}

async function handlePaymentVoucher(context: PaymentContext, interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.inGuild() || (context.guildId && interaction.guildId !== context.guildId)) return;
  const navigation = context.navigation ? parseNavigationAction(interaction.customId) : null;
  const action = navigation?.method === "redeem" ? navigation : parseVoucherAction(interaction.customId, "redeem");
  if (!action) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (context.config.TRUEMONEY_ENABLED !== true || !context.paymentVoucher) throw new Error("ร้านยังไม่เปิดรับชำระด้วยซองอั่งเปา");
  const giftUrl = interaction.fields.getTextInputValue("gift_url").trim();
  if (!/^https:\/\/gift\.truemoney\.com\/campaign\/\?v=[A-Za-z0-9_-]+$/.test(giftUrl))
    throw new Error("กรุณากรอกลิงก์ซองอั่งเปา TrueMoney ที่ถูกต้อง");
  // Validate the configured success design before asking the backend to receive money.
  const receiptContext = { ...context, presentations: { payment_success: context.presentations.payment_success } };
  const preview = renderPresentation(receiptContext, "payment_success", baseVariables(context, action.amountSatang));
  const updateReceipt = navigation?.responseMode === "UPDATE";
  if (updateReceipt) {
    if (!interaction.isFromMessage()) throw new Error("ไม่พบข้อความเดิม กรุณาเลือกส่งข้อความใหม่");
    assertCanUpdate(interaction.message, preview);
  }
  const result = await context.paymentVoucher({ memberDiscordId: interaction.user.id, giftUrl,
    paymentMessageId: action.messageId, expectedAmountSatang: action.amountSatang, idempotencyKey: `payment:${interaction.id}` });
  if (result.status !== "SUCCEEDED" || result.amountSatang !== action.amountSatang) {
    throw new Error(result.status === "REDEEMING" || result.status === "RECONCILIATION_REQUIRED"
      ? "รายการกำลังประมวลผลหรือรอตรวจสอบ กรุณาติดต่อผู้ดูแลและอย่าชำระซ้ำ"
      : result.failureMessage ?? "ยังไม่สามารถยืนยันการชำระเงินได้ กรุณาติดต่อผู้ดูแลและอย่าชำระซ้ำ");
  }
  const success = renderPresentation(receiptContext, "payment_success", {
    ...baseVariables(context, action.amountSatang), fee_amount: "0", total_amount: money(result.amountSatang),
    paid_amount: money(result.amountSatang), member_mention: `<@${interaction.user.id}>`,
    member_id: interaction.user.id, payment_id: result.id, reference: result.reference ?? "", payment_method: "ซองอั่งเปา TrueMoney",
  });
  let receiptUpdated = false;
  try {
    await interaction.editReply({ content: `รับชำระเงิน ${money(result.amountSatang)} บาทสำเร็จแล้ว เลขรายการ ${result.id}`, allowedMentions: { parse: [] } });
    if (updateReceipt && interaction.isFromMessage()) {
      await interaction.message.edit(updatePayload(success) as never);
      receiptUpdated = true;
    } else await interaction.followUp(success);
  } catch (error) {
    await context.reportFeatureError("PAYMENT_RECEIPT_FAILED", error, { recoverable: true }).catch(() => undefined);
    await replyFeatureError(interaction, "payment-trigger", `รับชำระเงิน ${money(result.amountSatang)} บาทสำเร็จแล้ว แต่ส่งข้อความยืนยันไม่สำเร็จ เลขรายการ ${result.id} กรุณาอย่าชำระซ้ำ`,
      { code: "PAYMENT_RECEIPT_FAILED", warning: true, followUp: true });
  }
  if (!receiptUpdated && interaction.isFromMessage()) {
    const disableButtons = (components: unknown[]): unknown[] => components.map((component) => {
      if (!isRecord(component)) return component;
      return { ...component, ...(component.type === 2 ? { disabled: true } : {}),
        ...(Array.isArray(component.components) ? { components: disableButtons(component.components) } : {}) };
    });
    await interaction.message.edit({ components: disableButtons(interaction.message.components.map(component => component.toJSON())) } as never)
      .catch(() => undefined);
  }
}

function responseMode(config: Record<string, unknown>, method: string): ResponseMode {
  return config.response_mode === "NEW_MESSAGE" || config.response_mode === "UPDATE"
    ? config.response_mode : method === "voucher" ? "NEW_MESSAGE" : "UPDATE";
}
function navigationId(action: NavigationAction): string {
  return `${NAVIGATION_PREFIX}${action.method}:${action.amountSatang}:${action.messageId}:${action.responseMode === "UPDATE" ? "u" : "n"}`;
}
function parseNavigationAction(customId: string): NavigationAction | null {
  const match = customId.match(/^fujipp:payment:v11:(bank|wallet|back|voucher|redeem):(\d+):(\d{15,30}):(u|n)$/);
  if (!match) return null;
  const amountSatang = Number(match[2]);
  return Number.isSafeInteger(amountSatang) && amountSatang > 0 && amountSatang <= MAX_AMOUNT_SATANG
    ? { method: match[1] as NavigationAction["method"], amountSatang, messageId: match[3]!, responseMode: match[4] === "u" ? "UPDATE" : "NEW_MESSAGE" } : null;
}
function assertCanUpdate(message: Message, payload: Record<string, unknown>): void {
  if (message.flags?.has(MessageFlags.IsComponentsV2) && payload.flags !== MessageFlags.IsComponentsV2)
    throw new Error("Discord ไม่รองรับการเปลี่ยน Components V2 กลับเป็น Embed ในข้อความเดิม กรุณาเลือกส่งข้อความใหม่หรือใช้ Components V2 ทั้งสองหน้า");
}
function updatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return { content: null, embeds: [], components: [], ...payload };
}
function originalInvoiceId(message: Message): string {
  function find(value: unknown): string | undefined {
    if (Array.isArray(value)) { for (const item of value) { const id = find(item); if (id) return id; } }
    if (!isRecord(value)) return undefined;
    if (typeof value.custom_id === "string") {
      const action = parseVoucherAction(value.custom_id, "voucher") ?? parseNavigationAction(value.custom_id);
      if (action) return action.messageId;
    }
    return find(value.components);
  }
  return find(message.components.map(item => item.toJSON())) ?? message.id;
}
function navigationButtons(definition: Record<string, unknown>, slot: string, amount: number, messageId: string | undefined, voucherEnabled: boolean): ButtonBuilder[] {
  if (!messageId || !["method_selector", "bank_payment", "wallet_payment"].includes(slot)) return [];
  const actions = slot === "method_selector" ? ["bank", "wallet", ...(voucherEnabled ? ["voucher"] : [])] : ["back"];
  const resolved = resolvePaymentActions(actions.map(method => ({ type: 2, action: `payment.${method}` })), definition, amount, messageId, voucherEnabled, true);
  return resolved.map(button => new ButtonBuilder(button as never));
}

function parseVoucherAction(customId: string, action: "voucher" | "redeem"): { amountSatang: number; messageId: string } | null {
  const match = customId.match(new RegExp(`^${ACTION_PREFIX}${action}:(\\d+):(\\d{15,30})$`));
  if (!match) return null;
  const amountSatang = Number(match[1]);
  return Number.isSafeInteger(amountSatang) && amountSatang > 0 && amountSatang <= MAX_AMOUNT_SATANG
    ? { amountSatang, messageId: match[2]! } : null;
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
  context: PaymentContext,
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
  context: PaymentContext,
  slot: string,
  variables: Record<string, string>,
  selectorAmountSatang?: number,
  selectorMessageId?: string,
): Record<string, unknown> {
  const definition = isRecord(context.presentations[slot])
    ? context.presentations[slot]
    : null;
  if (!definition) throw new Error(`Presentation ${slot} is not configured`);
  const mode = String(definition.mode ?? "COMPONENTS_V2").toUpperCase();
  const legacyActions = () => selectorAmountSatang === undefined ? [] : context.navigation
    ? navigationButtons(definition, slot, selectorAmountSatang, selectorMessageId, context.config.TRUEMONEY_ENABLED === true)
    : paymentButtons(definition, selectorAmountSatang, context.config.TRUEMONEY_ENABLED === true ? selectorMessageId : undefined);

  if (mode === "COMPONENTS_V2") {
    const source = isRecord(definition.components_v2)
      ? definition.components_v2
      : definition;
    if (!Array.isArray(source.components))
      throw new Error(`Presentation ${slot} must contain Components V2 blocks`);
    const components = normalizeComponentColors(
      deepRender(source.components, variables),
    );
    const explicitButtons = definition.feature_buttons_layout === "CUSTOM" || containsPaymentAction(components);
    const resolved = selectorAmountSatang === undefined ? components : resolvePaymentActions(components, definition,
      selectorAmountSatang, selectorMessageId, context.config.TRUEMONEY_ENABLED === true, context.navigation);
    if (!explicitButtons) {
      const actions = legacyActions();
      if (actions.length) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(actions).toJSON();
        const container = context.navigation && slot !== "method_selector" ? [...resolved].reverse().find(item => isRecord(item) && item.type === 17 && Array.isArray(item.components)) : undefined;
        if (isRecord(container)) (container.components as unknown[]).push(row);
        else resolved.push(row);
      }
    }
    return {
      flags: MessageFlags.IsComponentsV2,
      components: resolved,
      allowedMentions: { parse: [] },
    };
  }

  const source = isRecord(definition.embed) ? definition.embed : definition;
  const actions = legacyActions();
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

function containsPaymentAction(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsPaymentAction);
  return isRecord(value) && ((typeof value.action === "string" && value.action.startsWith("payment."))
    || Object.values(value).some(containsPaymentAction));
}

function resolvePaymentActions(components: unknown[], definition: Record<string, unknown>, amount: number,
  messageId: string | undefined, voucherEnabled: boolean, navigation = false): unknown[] {
  const configured = isRecord(definition.components) ? definition.components : {};
  const actions: Record<string, { role: string; method: string; label: string; emoji: string; style: ButtonStyle }> = {
    "payment.bank": { role: "bank_button", method: "bank", label: "สแกน QR ธนาคาร", emoji: "🏦", style: ButtonStyle.Success },
    "payment.wallet": { role: "wallet_button", method: "wallet", label: "ชำระผ่าน Wallet", emoji: "🟠", style: ButtonStyle.Primary },
    ...(navigation ? { "payment.back": { role: "back_button", method: "back", label: "กลับไปเลือกช่องทาง", emoji: "↩️", style: ButtonStyle.Secondary } } : {}),
    "payment.voucher": { role: "voucher_button", method: "voucher", label: "ชำระด้วยซองอั่งเปา", emoji: "🧧", style: ButtonStyle.Danger },
  };
  function resolve(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(resolve);
    if (!isRecord(value)) return value;
    if (typeof value.action === "string" && value.action.startsWith("payment.")) {
      const action = actions[value.action];
      if (!action) throw new Error("Unknown Payment Trigger button action");
      const rootValue = configured[action.role];
      const root = isRecord(rootValue) ? rootValue : {};
      if (navigation && !messageId) throw new Error("Payment invoice is missing");
      const id = navigation ? navigationId({ method: action.method as NavigationAction["method"], amountSatang: amount, messageId: messageId!,
        responseMode: responseMode({ ...root, ...value }, action.method) })
        : `${ACTION_PREFIX}${action.method}:${amount}${action.method === "voucher" ? `:${messageId}` : ""}`;
      return configuredButton({ ...root, ...value }, id, action.label, action.emoji, action.style)
        .setDisabled(value.disabled === true || (action.method === "voucher" && (!voucherEnabled || !messageId))).toJSON();
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)]));
  }
  return components.map(resolve);
}

function paymentButtons(
  definition: Record<string, unknown>,
  amountSatang: number,
  messageId?: string,
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
    ...(messageId ? [configuredButton(configured.voucher_button, `${ACTION_PREFIX}voucher:${amountSatang}:${messageId}`,
      "ชำระด้วยซองอั่งเปา", "🧧", ButtonStyle.Danger)] : []),
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
    .setStyle([1, 2, 3, 4].includes(Number(config.style)) ? Number(config.style) :
      styles[String(config.style ?? "").toLowerCase()] ?? fallbackStyle);
  const emoji = isRecord(config.emoji) ? config.emoji as APIMessageComponentEmoji : String(config.emoji ?? (config.display_mode === "EMOJI_ONLY" ? "◀️" : fallbackEmoji)).trim();
  if (emoji)
    try {
      button.setEmoji(emoji);
    } catch {
      /* Invalid configured emoji is omitted. */
    }
  if (config.display_mode === "EMOJI_ONLY") {
    try { button.toJSON(); } catch { button.setEmoji("◀️"); }
    if (!("emoji" in button.data) || !button.data.emoji) button.setEmoji("◀️");
  } else button.setLabel(String(config.label ?? fallbackLabel).slice(0, 80));
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


export { parseAction, parseAmountSatang, parseTrigger };
