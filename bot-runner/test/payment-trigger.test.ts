import assert from "node:assert/strict";
import { assertFeatureError } from "./assert-feature-error.js";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  MessageFlags,
  PermissionFlagsBits,
  type Client,
  type Message,
} from "discord.js";
import { paymentTriggerFeature } from "../src/features/payment-trigger/index.js";
import type { FeatureContext } from "../src/types.js";

function context(
  client: EventEmitter,
  overrides: Partial<FeatureContext> = {},
): FeatureContext {
  return {
    botId: "bot-1",
    installationId: "install-1",
    guildId: "111111111111111",
    client: client as Client,
    config: {
      PAYMENT_TRIGGER_PREFIX: "p",
      WALLET_FEE_SATANG: 500,
      BANK_QR_IMAGE_URL: "https://example.com/payment-qr.png",
      WALLET_NUMBER: "0812345678",
    },
    secrets: {},
    presentations: paymentPresentations(),
    runtimeState: {},
    runtimeSubscription: {
      id: "runtime-1",
      currentPeriodEnd: "2099-01-01T00:00:00Z",
      autoRenew: false,
    },
    installedFeatureCodes: new Set(),
    permissions: { canUse: () => false },
    reportFeatureError: async () => undefined,
    saveRuntimeState: async () => undefined,
    wallet: {} as FeatureContext["wallet"],
    robux: {} as FeatureContext["robux"],
    memberSpending: {} as FeatureContext["memberSpending"],
    ...overrides,
  };
}

function paymentPresentations(): Record<string, unknown> {
  return {
    method_selector: {
      mode: "COMPONENTS_V2",
      components: {
        bank_button: { label: "QR", emoji: "🏦", style: "success" },
        wallet_button: { label: "Wallet", emoji: "🟠", style: "primary" },
      },
      components_v2: {
        components: [{ type: 10, content: "ยอด {{base_amount}} บาท" }],
      },
    },
    bank_payment: {
      mode: "COMPONENTS_V2",
      components_v2: {
        components: [{ type: 10, content: "QR {{amount}} {{qr_image_url}}" }],
      },
    },
    wallet_payment: {
      mode: "COMPONENTS_V2",
      components_v2: {
        components: [
          {
            type: 10,
            content:
              "Wallet {{base_amount}} + {{fee_amount}} = {{total_amount}} {{wallet_number}}",
          },
        ],
      },
    },
    invalid_amount: {
      mode: "COMPONENTS_V2",
      components_v2: {
        components: [{ type: 10, content: "ใช้ {{trigger}}10" }],
      },
    },
  };
}

function adminMessage(
  content: string,
  sent: Array<Record<string, unknown>>,
  deletion: { value: boolean },
): Message {
  return {
    id: "444444444444444",
    content,
    guildId: "111111111111111",
    channelId: "555555555555555",
    author: { id: "666666666666666", bot: false },
    member: {
      permissions: {
        has: (permission: bigint) =>
          permission === PermissionFlagsBits.Administrator,
      },
    },
    channel: {
      guildId: "111111111111111",
      isTextBased: () => true,
      send: async (payload: Record<string, unknown>) => {
        sent.push(payload);
      },
    },
    inGuild: () => true,
    delete: async () => {
      deletion.value = true;
    },
  } as unknown as Message;
}

function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

const invoiceId = "444444444444444";
const voucherModalId = `fujipp:payment:redeem:10000:${invoiceId}`;
const giftUrl = "https://gift.truemoney.com/campaign/?v=testVoucher";
function envelopeContext(client: EventEmitter, overrides: Partial<FeatureContext> = {}): FeatureContext {
  const base = context(client);
  return { ...base, config: { ...base.config, TRUEMONEY_ENABLED: true },
    presentations: { ...base.presentations, payment_success: { mode: "COMPONENTS_V2", components_v2: {
      components: [{ type: 10, content: "{{paid_amount}} {{member_mention}} {{reference}}" }],
    } } }, ...overrides };
}
function voucherSubmission() {
  const replies: Record<string, unknown>[] = [], receipts: Record<string, unknown>[] = [], edits: Record<string, unknown>[] = [];
  const interaction = { customId: voucherModalId, id: "777777777777777", user: { id: "666666666666666" },
    guildId: "111111111111111", deferred: false, replied: false, isButton: () => false, isModalSubmit: () => true,
    inGuild: () => true, isFromMessage: () => true, fields: { getTextInputValue: () => giftUrl },
    deferReply: async (payload: Record<string, unknown>) => { interaction.deferred = true; assert.equal(payload.flags, MessageFlags.Ephemeral); },
    editReply: async (payload: Record<string, unknown>) => { replies.push(payload); },
    followUp: async (payload: Record<string, unknown>) => { receipts.push(payload); },
    message: { components: [{ toJSON: () => ({ type: 1, components: [{ type: 2, custom_id: "pay", disabled: false }] }) }],
      edit: async (payload: Record<string, unknown>) => { edits.push(payload); } },
  };
  return { interaction, replies, receipts, edits };
}
function confirmedVoucher(): import("../src/types.js").VoucherRedemption {
  return { id: "payment-1", botId: "bot-1", memberDiscordId: "666666666666666", status: "SUCCEEDED", amountSatang: 10000, reference: "ref-1", failureCode: null, failureMessage: null };
}

test("envelopes add a third invoice-specific button only when enabled", async () => {
  for (const enabled of [true, false]) {
    const client = new EventEmitter(), sent: Record<string, unknown>[] = [], base = envelopeContext(client);
    const dispose = await paymentTriggerFeature.activate({ ...base, config: { ...base.config, TRUEMONEY_ENABLED: enabled } });
    try {
      client.emit("messageCreate", adminMessage("p100", sent, { value: false })); await settle();
      const row = (sent[0]!.components as Array<{ components?: Array<{ custom_id: string }> }>)[1]!;
      assert.equal(row.components!.length, enabled ? 3 : 2);
      if (enabled) assert.equal(row.components![2]!.custom_id, `fujipp:payment:voucher:10000:${invoiceId}`);
    } finally { await dispose(); }
  }
});

test("the envelope button opens a required link modal without redeeming money", async () => {
  const client = new EventEmitter(), modals: Array<{ toJSON(): unknown }> = [];
  const dispose = await paymentTriggerFeature.activate(envelopeContext(client, { paymentVoucher: async () => assert.fail("must not redeem") }));
  try {
    client.emit("interactionCreate", { customId: `fujipp:payment:voucher:10000:${invoiceId}`, guildId: "111111111111111",
      isButton: () => true, inGuild: () => true, showModal: async (modal: { toJSON(): unknown }) => { modals.push(modal); } });
    await settle();
    const modal = modals[0]!.toJSON() as { custom_id: string; components: Array<{ components: Array<{ required: boolean; custom_id: string }> }> };
    assert.equal(modal.custom_id, voucherModalId);
    assert.equal(modal.components[0]!.components[0]!.custom_id, "gift_url");
    assert.equal(modal.components[0]!.components[0]!.required, true);
  } finally { await dispose(); }
});

for (const mode of ["EMBED", "COMPONENTS_V2"]) {
  test(`confirmed envelope posts public ${mode} receipt and disables old buttons`, async () => {
    const client = new EventEmitter(), state = voucherSubmission();
    const definition = mode === "EMBED"
      ? { mode, embed: { title: "ชำระเงินสำเร็จ", description: "{{paid_amount}} {{member_mention}} {{reference}}" } }
      : { mode, components_v2: { components: [{ type: 10, content: "{{paid_amount}} {{member_mention}} {{reference}}" }] } };
    const dispose = await paymentTriggerFeature.activate(envelopeContext(client, {
      presentations: { payment_success: definition }, paymentVoucher: async (input) => {
        assert.equal(state.interaction.deferred, true);
        assert.deepEqual(input, { memberDiscordId: "666666666666666", giftUrl, paymentMessageId: invoiceId, expectedAmountSatang: 10000, idempotencyKey: "payment:777777777777777" });
        return confirmedVoucher();
      },
    }));
    try {
      client.emit("interactionCreate", state.interaction); await settle();
      assert.equal(state.receipts.length, 1); assert.equal(state.replies.length, 1);
      assert.equal(state.receipts[0]!.flags, mode === "COMPONENTS_V2" ? MessageFlags.IsComponentsV2 : undefined);
      assert.match(JSON.stringify(state.receipts), /100 <@666666666666666> ref-1/);
      assert.deepEqual(state.edits[0], { components: [{ type: 1, components: [{ type: 2, custom_id: "pay", disabled: true }] }] });
      assert.equal(JSON.stringify(state.receipts).includes(giftUrl), false);
    } finally { await dispose(); }
  });
}
for (const status of ["VERIFY_FAILED", "REDEEMING", "RECONCILIATION_REQUIRED"]) {
  test(`envelope ${status} never posts success or disables the selector`, async () => {
    const client = new EventEmitter(), state = voucherSubmission(), errors: unknown[][] = [];
    const dispose = await paymentTriggerFeature.activate(envelopeContext(client, {
      paymentVoucher: async () => ({ ...confirmedVoucher(), status, amountSatang: null, failureMessage: "ยอดไม่ตรง" }),
      reportFeatureError: async (...args) => { errors.push(args); },
    }));
    try {
      client.emit("interactionCreate", state.interaction); await settle();
      assert.equal(state.receipts.length, 0); assert.equal(state.edits.length, 0);
      assertFeatureError(state.replies[0], "Payment Trigger", "PAYMENT_VOUCHER_FAILED");
      assert.deepEqual(errors[0]![2], { recoverable: true });
    } finally { await dispose(); }
  });
}
test("a broken receipt or invalid URL cannot redeem money", async () => {
  for (const brokenDesign of [true, false]) {
    const client = new EventEmitter(), state = voucherSubmission();
    if (!brokenDesign) state.interaction.fields.getTextInputValue = () => "https://evil.invalid/secret";
    const dispose = await paymentTriggerFeature.activate(envelopeContext(client, {
      ...(brokenDesign ? { presentations: {} } : {}), paymentVoucher: async () => assert.fail("must not redeem"),
    }));
    try {
      client.emit("interactionCreate", state.interaction); await settle();
      assert.equal(state.receipts.length, 0);
      assertFeatureError(state.replies[0], "Payment Trigger", "PAYMENT_VOUCHER_FAILED");
    } finally { await dispose(); }
  }
});
test("failure to post a public receipt does not turn received money into a payment failure", async () => {
  const client = new EventEmitter(), state = voucherSubmission(), errors: unknown[][] = [];
  state.interaction.followUp = async () => { throw new Error("Missing permissions"); };
  const dispose = await paymentTriggerFeature.activate(envelopeContext(client, { paymentVoucher: async () => confirmedVoucher(),
    reportFeatureError: async (...args) => { errors.push(args); } }));
  try {
    client.emit("interactionCreate", state.interaction); await settle();
    assert.match(String(state.replies[0]!.content), /รับชำระเงิน 100 บาทสำเร็จ/);
    assert.equal(errors[0]![0], "PAYMENT_RECEIPT_FAILED"); assert.equal(state.edits.length, 1);
  } finally { await dispose(); }
});

test("a broken payment design reports a recoverable failure and sends an Embed in the trigger channel", async () => {
  const client = new EventEmitter(), sent: Array<Record<string, unknown>> = [], errors: unknown[][] = [];
  const dispose = await paymentTriggerFeature.activate(context(client, {
    presentations: {}, reportFeatureError: async (...args) => { errors.push(args); },
  }));
  try {
    client.emit("messageCreate", adminMessage("p10", sent, { value: false })); await settle();
    assert.equal(sent.length, 1);
    assertFeatureError(sent[0], "Payment Trigger", "PAYMENT_TRIGGER_FAILED");
    assert.deepEqual(errors[0]?.[2], { recoverable: true });
  } finally { await dispose(); }
});

test("a failed payment button responds privately with an Embed without replacing its public panel", async () => {
  const client = new EventEmitter(), replies: unknown[] = [];
  const dispose = await paymentTriggerFeature.activate(context(client, { presentations: {} }));
  try {
    client.emit("interactionCreate", {
      customId: "fujipp:payment:wallet:1000", guildId: "111111111111111",
      isButton: () => true, inGuild: () => true, deferred: false, replied: false,
      reply: async (payload: unknown) => { replies.push(payload); },
      update: async () => assert.fail("the invalid design must not replace the panel"),
    });
    await settle();
    assert.equal(replies.length, 1);
    assertFeatureError(replies[0], "Payment Trigger", "PAYMENT_METHOD_SELECTION_FAILED");
    assert.equal((replies[0] as { flags: number }).flags, MessageFlags.Ephemeral);
  } finally { await dispose(); }
});

test("p10 deletes the administrator trigger and sends a Components V2 payment selector", async () => {
  const client = new EventEmitter();
  const sent: Array<Record<string, unknown>> = [];
  const deletion = { value: false };
  const dispose = await paymentTriggerFeature.activate(context(client));

  client.emit("messageCreate", adminMessage("p10", sent, deletion));
  await settle();

  assert.equal(deletion.value, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.flags, MessageFlags.IsComponentsV2);
  const components = sent[0]?.components as Array<Record<string, unknown>>;
  assert.deepEqual(components[0], { type: 10, content: "ยอด 10 บาท" });
  const buttons = components[1]?.components as Array<Record<string, unknown>>;
  assert.equal(buttons[0]?.custom_id, "fujipp:payment:bank:1000");
  assert.equal(buttons[0]?.label, "QR");
  assert.equal(buttons[1]?.custom_id, "fujipp:payment:wallet:1000");
  assert.equal(buttons[1]?.label, "Wallet");
  await dispose();
});

test("choosing Wallet adds the configured five-baht fee", async () => {
  const client = new EventEmitter();
  const updates: Array<Record<string, unknown>> = [];
  const dispose = await paymentTriggerFeature.activate(context(client));
  client.emit("interactionCreate", {
    customId: "fujipp:payment:wallet:1000",
    guildId: "111111111111111",
    inGuild: () => true,
    isButton: () => true,
    isRepliable: () => true,
    update: async (payload: Record<string, unknown>) => {
      updates.push(payload);
    },
  });
  await settle();

  assert.equal(updates[0]?.flags, MessageFlags.IsComponentsV2);
  assert.deepEqual(updates[0]?.components, [
    { type: 10, content: "Wallet 10 + 5 = 15 0812345678" },
  ]);
  await dispose();
});

test("choosing bank QR keeps the original amount", async () => {
  const client = new EventEmitter();
  const updates: Array<Record<string, unknown>> = [];
  const dispose = await paymentTriggerFeature.activate(context(client));
  client.emit("interactionCreate", {
    customId: "fujipp:payment:bank:1050",
    guildId: "111111111111111",
    inGuild: () => true,
    isButton: () => true,
    isRepliable: () => true,
    update: async (payload: Record<string, unknown>) => {
      updates.push(payload);
    },
  });
  await settle();

  assert.deepEqual(updates[0]?.components, [
    { type: 10, content: "QR 10.5 https://example.com/payment-qr.png" },
  ]);
  await dispose();
});

test("p without an amount sends the Components V2 usage message", async () => {
  const client = new EventEmitter();
  const sent: Array<Record<string, unknown>> = [];
  const deletion = { value: false };
  const dispose = await paymentTriggerFeature.activate(context(client));
  client.emit("messageCreate", adminMessage(" p ", sent, deletion));
  await settle();

  assert.equal(deletion.value, true);
  assert.equal(sent[0]?.flags, MessageFlags.IsComponentsV2);
  assert.deepEqual(sent[0]?.components, [{ type: 10, content: "ใช้ p10" }]);
  await dispose();
});

test("ignores payment triggers from non-administrators", async () => {
  const client = new EventEmitter();
  let sent = false;
  const dispose = await paymentTriggerFeature.activate(context(client));
  client.emit("messageCreate", {
    content: "p10",
    guildId: "111111111111111",
    author: { bot: false },
    inGuild: () => true,
    member: { permissions: { has: () => false } },
    channel: {
      guildId: "111111111111111",
      isTextBased: () => true,
      send: async () => {
        sent = true;
      },
    },
  } as unknown as Message);
  await settle();

  assert.equal(sent, false);
  await dispose();
});

for (const enabled of [false, true]) {
  test(`custom payment buttons remain inside their container and use runtime invoice IDs (envelopes ${enabled})`, async () => {
    const client = new EventEmitter(), sent: Record<string, unknown>[] = [];
    const base = envelopeContext(client);
    const dispose = await paymentTriggerFeature.activate({ ...base, config: { ...base.config, TRUEMONEY_ENABLED: enabled },
      presentations: { method_selector: { mode: "COMPONENTS_V2", feature_buttons_layout: "CUSTOM",
        components: { bank_button: { label: "Root bank label", style: "success" } },
        components_v2: { components: [{ type: 17, accent_color: "#5865f2", components: [
          { type: 10, content: "Pay {{amount}}" },
          { type: 1, components: [
            { type: 2, action: "payment.voucher", label: "Envelope", style: 3, emoji: { name: "🧧" } },
            { type: 2, action: "payment.bank", style: 4 },
            { type: 2, style: 5, label: "Help", url: "https://example.com" },
          ] },
        ] }] },
      } },
    });
    try {
      client.emit("messageCreate", adminMessage("p100", sent, { value: false })); await settle();
      const blocks = sent[0]!.components as Array<{ components: Array<Record<string, unknown>> }>;
      assert.equal(blocks.length, 1);
      const buttons = blocks[0]!.components[1]!.components as Array<Record<string, unknown>>;
      assert.equal(buttons.length, 3);
      assert.equal(buttons[0]!.custom_id, `fujipp:payment:voucher:10000:${invoiceId}`);
      assert.equal(buttons[0]!.disabled, !enabled);
      assert.deepEqual(buttons[0]!.emoji, { name: "🧧" });
      assert.equal(buttons[1]!.custom_id, "fujipp:payment:bank:10000");
      assert.equal(buttons[1]!.label, "Root bank label");
      assert.equal(buttons[1]!.style, 4);
      assert.equal(buttons[2]!.url, "https://example.com");
      assert.equal(JSON.stringify(sent[0]).includes('"action"'), false);
    } finally { await dispose(); }
  });
}

test("an intentionally button-free custom layout does not restore automatic payment buttons", async () => {
  const client = new EventEmitter(), sent: Record<string, unknown>[] = [];
  const dispose = await paymentTriggerFeature.activate(envelopeContext(client, { presentations: {
    method_selector: { mode: "COMPONENTS_V2", feature_buttons_layout: "CUSTOM", components_v2: { components: [{ type: 10, content: "No buttons" }] } },
  } }));
  try {
    client.emit("messageCreate", adminMessage("p100", sent, { value: false })); await settle();
    assert.deepEqual(sent[0]!.components, [{ type: 10, content: "No buttons" }]);
  } finally { await dispose(); }
});
