import assert from "node:assert/strict";
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
