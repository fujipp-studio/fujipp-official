import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { ChannelType, MessageFlags, PermissionFlagsBits, type Client, type Message } from "discord.js";
import { channelMessageTriggersFeature } from "../src/features/channel-message-triggers/index.js";
import type { FeatureContext } from "../src/types.js";

function context(client: EventEmitter, overrides: Partial<FeatureContext> = {}): FeatureContext {
  return {
    botId: "bot-1", installationId: "install-1", guildId: "111111111111111",
    client: client as Client,
    config: {}, secrets: {}, presentations: {}, runtimeState: {},
    runtimeSubscription: { id: "runtime-1", currentPeriodEnd: "2099-01-01T00:00:00Z", autoRenew: false },
    installedFeatureCodes: new Set(),
    permissions: { canUse: () => false },
    reportFeatureError: async () => undefined,
    saveRuntimeState: async () => undefined,
    wallet: {} as FeatureContext["wallet"], robux: {} as FeatureContext["robux"],
    memberSpending: {} as FeatureContext["memberSpending"],
    ...overrides,
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

test("sends the selected template when a text channel is created in a configured category", async () => {
  const client = new EventEmitter();
  const sent: Array<Record<string, unknown>> = [];
  const dispose = await channelMessageTriggersFeature.activate(context(client, {
    config: { CHANNEL_CREATE_RULES: [{ categoryId: "222222222222222", template: "template_2" }] },
    presentations: {
      template_2: {
        mode: "EMBED",
        embed: {
          title: "Welcome {{channel_name}}", description: "{{category_name}}",
          color: "#5865f2", image_url: "https://example.com/{{channel_id}}.png",
        },
      },
    },
  }));

  client.emit("channelCreate", {
    type: ChannelType.GuildText, id: "333333333333333", name: "order-42",
    guildId: "111111111111111", guild: { name: "Shop" }, parentId: "222222222222222",
    parent: { id: "222222222222222", name: "Orders" },
    send: async (payload: Record<string, unknown>) => { sent.push(payload); },
  });
  await settle();

  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0]?.embeds, [{
    title: "Welcome order-42", description: "Orders", color: 0x5865f2,
    image: { url: "https://example.com/333333333333333.png" },
  }]);
  await dispose();
});

test("deletes an administrator trigger and sends its Components V2 template", async () => {
  const client = new EventEmitter();
  const sent: Array<Record<string, unknown>> = [];
  let deleted = false;
  const dispose = await channelMessageTriggersFeature.activate(context(client, {
    config: { ADMIN_MESSAGE_TRIGGERS: [{ trigger: "pay", template: "template_1" }] },
    presentations: {
      template_1: { mode: "COMPONENTS_V2", components_v2: { components: [{ type: 10, content: "By {{admin_name}}" }] } },
    },
  }));
  const channel = {
    guildId: "111111111111111", isTextBased: () => true,
    send: async (payload: Record<string, unknown>) => { sent.push(payload); },
  };
  const message = {
    id: "444444444444444", content: "  PAY ", guildId: "111111111111111", channelId: "555555555555555",
    author: { id: "666666666666666", bot: false, displayName: "Owner" },
    member: { displayName: "Admin", permissions: { has: (permission: bigint) => permission === PermissionFlagsBits.Administrator } },
    guild: { name: "Shop" }, channel, inGuild: () => true,
    delete: async () => { deleted = true; },
  } as unknown as Message;

  client.emit("messageCreate", message);
  await settle();

  assert.equal(deleted, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.flags, MessageFlags.IsComponentsV2);
  assert.deepEqual(sent[0]?.components, [{ type: 10, content: "By Admin" }]);
  await dispose();
});

test("ignores matching messages from members without Administrator permission", async () => {
  const client = new EventEmitter();
  let deleted = false;
  let sent = false;
  const dispose = await channelMessageTriggersFeature.activate(context(client, {
    config: { ADMIN_MESSAGE_TRIGGERS: [{ trigger: "pay", template: "template_1" }] },
    presentations: { template_1: { mode: "EMBED", embed: { description: "Payment" } } },
  }));
  client.emit("messageCreate", {
    content: "pay", guildId: "111111111111111", author: { bot: false },
    member: { permissions: { has: () => false } }, inGuild: () => true,
    delete: async () => { deleted = true; },
    channel: { guildId: "111111111111111", isTextBased: () => true, send: async () => { sent = true; } },
  } as unknown as Message);
  await settle();

  assert.equal(deleted, false);
  assert.equal(sent, false);
  await dispose();
});
