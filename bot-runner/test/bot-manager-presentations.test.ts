import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { fork } from "node:child_process";
import test from "node:test";
import { ChannelType, MessageFlags, type Client } from "discord.js";
import { BotManager, makeFingerprint, makeRestartFingerprint } from "../src/bot-manager.js";
import { ProcessBotManager } from "../src/process-bot-manager.js";
import { renderTemplate } from "../src/features/presentation.js";
import type { RuntimeApi } from "../src/api-client.js";
import type { FeatureContext, FeatureDisposer, FeatureModule, RuntimeBot, RuntimeFeature } from "../src/types.js";

const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const guildId = "111111111111111111", memberId = "222222222222222222";
const embed = (text: string) => ({ mode: "EMBED", embeds: [{ description: text }] });
const components = (text: string) => ({ mode: "COMPONENTS_V2", components: [{ type: 10, content: text }] });
function feature(key = "member-spending"): RuntimeFeature {
  return { installationId: key, code: key, runtimeKey: key, version: "1.0.0", configRevision: 1,
    config: {}, secrets: {}, runtimeState: {}, presentations: { returning_card: embed("Old {{member}}") } };
}
function bot(features = [feature()]): RuntimeBot {
  return { id: "bot", name: "Bot", discordToken: "token", discordApplicationId: "app", discordGuildId: guildId,
    restartRevision: 0, runtimeSubscription: { id: "runtime", currentPeriodEnd: "2099-01-01T00:00:00Z", autoRenew: false }, features };
}
class FakeClient extends EventEmitter {
  ready = false;
  logins = 0;
  destroyed = false;
  user = undefined;
  registrations: unknown[] = [];
  guild = { commands: { create: async (command: unknown) => { this.registrations.push(command); } },
    members: { fetch: async () => ({ displayName: "Customer", displayAvatarURL: () => "https://example.com/avatar.png" }) } };
  guilds = { fetch: async () => this.guild };
  isReady() { return this.ready; }
  async login() { this.logins++; this.ready = true; this.emit("clientReady"); return "token"; }
  destroy() { this.destroyed = true; }
}
function api(statuses: unknown[] = []): RuntimeApi {
  return { reportStatus: async (status: unknown) => { statuses.push(status); },
    addMemberSpending: async () => ({ memberDiscordId: memberId, amountSatang: 20000, txCount: 2, thisMonthSatang: 10000, thisMonthTxCount: 1 }),
  } as unknown as RuntimeApi;
}
async function sendSpending(client: FakeClient): Promise<Record<string, unknown>> {
  const sent: Array<Record<string, unknown>> = [], edits: unknown[] = [];
  client.emit("interactionCreate", {
    id: "interaction", commandName: "spending", inGuild: () => true,
    isChatInputCommand: () => true, isModalSubmit: () => false, isRepliable: () => true,
    memberPermissions: { has: () => true }, guild: client.guild,
    options: { getSubcommand: () => "add", getUser: () => ({ id: memberId, username: "Customer" }), getInteger: () => 100 },
    channel: { isTextBased: () => true, send: async (payload: Record<string, unknown>) => { sent.push(payload); } },
    deferReply: async () => undefined, editReply: async (payload: unknown) => { edits.push(payload); },
  });
  await settle();
  assert.equal(edits.length, 1);
  assert.equal(sent.length, 1);
  return sent[0]!;
}

test("Member Spending uses new Embed and Components V2 designs on the same client and handlers", async () => {
  const clients: FakeClient[] = [], statuses: unknown[] = [];
  const manager = new BotManager(api(statuses), () => { const client = new FakeClient(); clients.push(client); return client as unknown as Client; });
  const original = bot();
  try {
    await manager.reconcile([original]); await settle();
    const client = clients[0]!, listeners = client.listeners("interactionCreate");
    assert.deepEqual((await sendSpending(client)).embeds, [{ description: "Old Customer" }]);
    for (const design of [embed("New {{member}}"), components("V2 {{member}}"), embed("Back to Embed")]) {
      const next = structuredClone(original);
      next.features[0]!.configRevision++;
      next.features[0]!.presentations.returning_card = design;
      assert.equal(await manager.reconcile([next]), true);
      const payload = await sendSpending(client);
      if (design.mode === "COMPONENTS_V2") {
        assert.equal(payload.flags, MessageFlags.IsComponentsV2);
        assert.deepEqual(payload.components, [{ type: 10, content: "V2 Customer" }]);
      } else assert.deepEqual(payload.embeds, [{ description: design.embeds![0]!.description.replace("{{member}}", "Customer") }]);
      assert.deepEqual(client.listeners("interactionCreate"), listeners);
    }
    assert.equal(clients.length, 1);
    assert.equal(client.logins, 1);
    assert.equal(client.destroyed, false);
    assert.equal(client.registrations.length, 1);
    assert.equal((statuses as Array<{ status: string }>).some(s => s.status === "STOPPED"), false);
  } finally { await manager.shutdown(); }
});

test("presentation edits preserve other features' active resources and context copies", async () => {
  let activations = 0, disposals = 0;
  let retained!: FeatureContext;
  const resource = { connected: true };
  const legacy: FeatureModule = { runtimeKey: "legacy", version: "1.0.0", intents: [], async activate(context) {
    activations++; retained = { ...context };
    return () => { disposals++; };
  } };
  const voice: FeatureModule = { runtimeKey: "voice", version: "1.0.0", intents: [], async activate() {
    return () => { resource.connected = false; };
  } };
  const original = bot([feature("legacy"), feature("voice")]);
  original.features[0]!.presentations = { panel: embed("Old"), obsolete: embed("Removed") };
  const manager = new BotManager(api(), () => new FakeClient() as unknown as Client, key => key === "legacy" ? legacy : voice);
  try {
    await manager.reconcile([original]);
    const view = retained.presentations;
    const next = structuredClone(original);
    next.features[0]!.configRevision++;
    next.features[0]!.presentations = { panel: components("Live") };
    await manager.reconcile([next]);
    assert.equal(retained.presentations, view);
    assert.deepEqual(renderTemplate(retained, "panel", {}).components, [{ type: 10, content: "Live" }]);
    assert.equal(retained.presentations.obsolete, undefined);
    assert.equal(activations, 1); assert.equal(disposals, 0);
    assert.equal(resource.connected, true);
  } finally { await manager.shutdown(); }
});

for (const [label, change] of [
  ["configuration", (next: RuntimeBot) => { next.features[0]!.config.SPENDING_DB_USE_OWN = true; }],
  ["credentials", (next: RuntimeBot) => { next.features[0]!.secrets.SPENDING_DB_URL = "postgresql://example.invalid/db"; }],
  ["feature version", (next: RuntimeBot) => { next.features[0]!.version = "2.0.0"; }],
  ["installation", (next: RuntimeBot) => { next.features[0]!.installationId = "replacement"; }],
  ["installing a feature", (next: RuntimeBot) => { next.features.push(feature("another")); }],
  ["uninstalling a feature", (next: RuntimeBot) => { next.features = []; }],
  ["Discord token", (next: RuntimeBot) => { next.discordToken = "replacement"; }],
  ["Discord guild", (next: RuntimeBot) => { next.discordGuildId = "another"; }],
  ["explicit restart", (next: RuntimeBot) => { next.restartRevision++; }],
] as const) {
  test(`${label} changes still restart when saved alongside designs`, async () => {
    const clients: FakeClient[] = [];
    const legacy: FeatureModule = { runtimeKey: "member-spending", version: "1.0.0", intents: [], async activate() { return () => undefined; } };
    const manager = new BotManager(api(), () => { const client = new FakeClient(); clients.push(client); return client as unknown as Client; }, () => legacy);
    const original = bot(), next = structuredClone(original);
    next.features[0]!.presentations.returning_card = components("Changed"); next.features[0]!.configRevision++;
    change(next);
    assert.notEqual(makeRestartFingerprint(original), makeRestartFingerprint(next));
    try {
      await manager.reconcile([original]); await manager.reconcile([next]);
      assert.equal(clients.length, 2); assert.equal(clients[0]!.destroyed, true);
    } finally { await manager.shutdown(); }
  });
}

test("revision-only and design-only updates do not require a restart", () => {
  const original = bot(), revision = structuredClone(original), design = structuredClone(original);
  revision.features[0]!.configRevision++;
  design.features[0]!.presentations.returning_card = components("Changed without a revision bump");
  for (const next of [revision, design]) {
    assert.notEqual(makeFingerprint(original), makeFingerprint(next));
    assert.equal(makeRestartFingerprint(original), makeRestartFingerprint(next));
  }
});

test("updates to a working feature do not restart an unrelated failed feature", async () => {
  let renders!: FeatureContext;
  const clients: FakeClient[] = [];
  const manager = new BotManager(api(), () => { const client = new FakeClient(); clients.push(client); return client as unknown as Client; }, key => ({
    runtimeKey: key, version: "1.0.0", intents: [], async activate(context) {
      if (key === "broken") throw new Error("Unavailable");
      renders = context; return () => undefined;
    },
  }));
  const original = bot([feature("healthy"), feature("broken")]);
  try {
    await manager.reconcile([original]);
    const next = structuredClone(original); next.features[0]!.configRevision++;
    next.features[0]!.presentations.returning_card = components("Updated");
    assert.equal(await manager.reconcile([next]), true);
    assert.equal(clients.length, 1); assert.deepEqual(renders.presentations.returning_card, components("Updated"));
  } finally { await manager.shutdown(); }
});

test("failed hot updates retain the last design and retry without restarting the bot", async () => {
  let view!: FeatureContext, attempts = 0;
  const clients: FakeClient[] = [];
  const module: FeatureModule = { runtimeKey: "live", version: "1.0.0", intents: [], supportsHotReload: true, async activate(context) {
    view = context;
    const dispose: FeatureDisposer = () => undefined;
    dispose.update = async () => { if (++attempts === 1) throw new Error("Retry update"); };
    return dispose;
  } };
  const manager = new BotManager(api(), () => { const client = new FakeClient(); clients.push(client); return client as unknown as Client; }, () => module);
  const original = bot([feature("live")]), next = structuredClone(original);
  next.features[0]!.configRevision++; next.features[0]!.presentations.returning_card = components("Updated");
  try {
    await manager.reconcile([original]);
    assert.equal(await manager.reconcile([next]), false);
    assert.deepEqual(view.presentations.returning_card, original.features[0]!.presentations.returning_card);
    assert.equal(await manager.reconcile([next]), true);
    assert.deepEqual(view.presentations.returning_card, components("Updated"));
    assert.equal(attempts, 2); assert.equal(clients.length, 1);
  } finally { await manager.shutdown(); }
});

class Child extends EventEmitter {
  connected = true;
  sent: Array<{ type: string; bot?: RuntimeBot }> = [];
  send(message: { type: string; bot?: RuntimeBot }) {
    this.sent.push(message);
    if (message.type === "shutdown") setImmediate(() => this.emit("exit", 0, null));
  }
  kill() {}
}

test("the supervisor sends and retries design updates to the same worker until the latest acknowledgment", async () => {
  const children: Child[] = [];
  const manager = new ProcessBotManager(api(), {}, (() => { const child = new Child(); children.push(child); return child; }) as unknown as typeof fork);
  const original = bot(), next = structuredClone(original);
  next.features[0]!.configRevision++; next.features[0]!.presentations.returning_card = components("Updated");
  try {
    await manager.reconcile([original]); await manager.reconcile([next]);
    assert.equal(children.length, 1); assert.equal(children[0]!.sent[1]!.type, "update");
    manager.retryUpdates(); assert.equal(children[0]!.sent.length, 3);
    children[0]!.emit("message", { type: "updated", fingerprint: makeFingerprint(original) }); await settle();
    manager.retryUpdates(); assert.equal(children[0]!.sent.length, 4);
    children[0]!.emit("message", { type: "updated", fingerprint: makeFingerprint(next) }); await settle();
    await manager.reconcile([next]); manager.retryUpdates(); assert.equal(children[0]!.sent.length, 4);
    const configChange = structuredClone(next); configChange.features[0]!.config.SPENDING_FIRST_ROLE_ID = "333333333333333333";
    await manager.reconcile([configChange]); assert.equal(children.length, 2);
  } finally { await manager.shutdown(); }
});

test("Message Sets configuration and another feature's design update together without restarting", async () => {
  const contexts = new Map<string, FeatureContext>();
  const clients: FakeClient[] = [];
  let customUpdates = 0;
  const manager = new BotManager(api(), () => { const client = new FakeClient(); clients.push(client); return client as unknown as Client; }, key => ({
    runtimeKey: key, version: "1.0.0", intents: [], ...(key === "message-sets" ? { supportsHotReload: true } : {}),
    async activate(context) {
      contexts.set(key, context);
      const dispose: FeatureDisposer = () => undefined;
      if (key === "message-sets") dispose.update = async () => { customUpdates++; };
      return dispose;
    },
  }));
  const original = bot([feature("message-sets"), feature("member-spending")]), next = structuredClone(original);
  next.features[0]!.configRevision++; next.features[0]!.config.MESSAGE_SETS = [{ name: "New", presentationSlot: "set_1" }];
  next.features[1]!.configRevision++; next.features[1]!.presentations.returning_card = components("Updated card");
  try {
    await manager.reconcile([original]); assert.equal(await manager.reconcile([next]), true);
    assert.equal(clients.length, 1); assert.equal(customUpdates, 1);
    assert.deepEqual(contexts.get("member-spending")!.presentations.returning_card, components("Updated card"));
  } finally { await manager.shutdown(); }
});

test("a lost Discord session still recovers with a new client on a design-only update", async () => {
  const clients: FakeClient[] = [];
  const manager = new BotManager(api(), () => { const client = new FakeClient(); clients.push(client); return client as unknown as Client; }, key => ({
    runtimeKey: key, version: "1.0.0", intents: [], async activate() { return () => undefined; },
  }));
  const original = bot(), next = structuredClone(original); next.features[0]!.configRevision++;
  next.features[0]!.presentations.returning_card = components("Updated");
  try {
    await manager.reconcile([original]); clients[0]!.emit("invalidated");
    await manager.reconcile([next]); assert.equal(clients.length, 2); assert.equal(clients[0]!.destroyed, true);
  } finally { await manager.shutdown(); }
});

test("a failed activation is retried instead of acknowledging an unapplied design", async () => {
  const clients: FakeClient[] = [];
  let activations = 0;
  const manager = new BotManager(api(), () => { const client = new FakeClient(); clients.push(client); return client as unknown as Client; }, key => ({
    runtimeKey: key, version: "1.0.0", intents: [], async activate() {
      if (++activations === 1) throw new Error("Unavailable");
      return () => undefined;
    },
  }));
  const original = bot(), next = structuredClone(original); next.features[0]!.configRevision++;
  next.features[0]!.presentations.returning_card = components("Updated");
  try {
    await manager.reconcile([original]); await manager.reconcile([next]);
    assert.equal(clients.length, 2); assert.equal(activations, 2);
  } finally { await manager.shutdown(); }
});

test("Channel Message Triggers render live Components V2 designs through the shared renderer", async () => {
  const clients: FakeClient[] = [], sent: Array<Record<string, unknown>> = [];
  const manager = new BotManager(api(), () => { const client = new FakeClient(); clients.push(client); return client as unknown as Client; });
  const original = bot([feature("channel-message-triggers")]);
  original.features[0]!.config.CHANNEL_CREATE_RULES = [{ categoryId: "333333333333333333", template: "template_1" }];
  original.features[0]!.presentations = { template_1: embed("Old {{channel_name}}") };
  const channel = { type: ChannelType.GuildText, id: "444444444444444444", name: "orders", guildId,
    guild: { name: "Shop" }, parentId: "333333333333333333", parent: null,
    send: async (payload: Record<string, unknown>) => { sent.push(payload); },
  };
  try {
    await manager.reconcile([original]);
    const client = clients[0]!, listener = client.listeners("channelCreate");
    client.emit("channelCreate", channel); await settle();
    assert.deepEqual(sent[0]!.embeds, [{ description: "Old orders" }]);
    const next = structuredClone(original); next.features[0]!.configRevision++;
    next.features[0]!.presentations.template_1 = components("New {{channel_name}}");
    await manager.reconcile([next]);
    client.emit("channelCreate", channel); await settle();
    assert.equal(sent[1]!.flags, MessageFlags.IsComponentsV2);
    assert.deepEqual(sent[1]!.components, [{ type: 10, content: "New orders" }]);
    assert.equal(clients.length, 1); assert.deepEqual(client.listeners("channelCreate"), listener);
  } finally { await manager.shutdown(); }
});
