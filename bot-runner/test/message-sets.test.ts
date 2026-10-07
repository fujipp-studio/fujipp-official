import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { MessageFlags, type Client, type Interaction } from "discord.js";
import {
  messageSetsFeature,
  readMessageSets,
} from "../src/features/message-sets/v1.0.0.js";
import {
  BotManager,
  makeFingerprint,
  makeRestartFingerprint,
} from "../src/bot-manager.js";
import { ProcessBotManager } from "../src/process-bot-manager.js";
import type { RuntimeApi } from "../src/api-client.js";
import type {
  FeatureContext,
  RuntimeBot,
  RuntimeFeature,
} from "../src/types.js";
import type { fork } from "node:child_process";

const settle = () => new Promise((resolve) => setImmediate(resolve));
const feature = (
  sets = [{ name: "Rules", presentationSlot: "set_1" }],
): RuntimeFeature => ({
  installationId: "install",
  code: "message-sets",
  version: "1.0.0",
  runtimeKey: "message-sets",
  configRevision: 1,
  config: { MESSAGE_SETS_COMMAND_NAME: "info", MESSAGE_SETS: sets },
  secrets: {},
  runtimeState: {},
  presentations: {
    set_1: {
      mode: "EMBED",
      embed: { title: "{{set_name}}", description: "Original" },
    },
  },
});
function bot(): RuntimeBot {
  return {
    id: "bot",
    name: "Bot",
    discordToken: "token",
    discordApplicationId: "app",
    discordGuildId: "guild",
    restartRevision: 0,
    runtimeSubscription: {
      id: "runtime",
      currentPeriodEnd: "2099-01-01T00:00:00Z",
      autoRenew: false,
    },
    features: [feature()],
  };
}
class FakeClient extends EventEmitter {
  user = undefined;
  ready = false;
  destroyed = false;
  registrations: unknown[] = [];
  deleted: string[] = [];
  application = {
    commands: {
      fetch: async () => ({
        find: (predicate: (command: { name: string; id: string }) => boolean) =>
          this.registrations
            .map((item) => ({
              name: (item as { name: string }).name,
              id: (item as { name: string }).name,
            }))
            .find(predicate),
      }),
      create: async (command: { name: string }) => {
        this.registrations.push(command);
        return { id: command.name, name: command.name };
      },
      delete: async (id: string) => {
        this.deleted.push(id);
      },
    },
  };
  isReady() {
    return this.ready;
  }
  async login() {
    this.ready = true;
    this.emit("clientReady");
    return "token";
  }
  destroy() {
    this.destroyed = true;
  }
}
function context(client: FakeClient): FeatureContext {
  const f = feature();
  return {
    botId: "bot",
    installationId: "install",
    guildId: "guild",
    client: client as unknown as Client,
    config: f.config,
    secrets: {},
    presentations: f.presentations,
    runtimeState: {},
    runtimeSubscription: bot().runtimeSubscription,
    installedFeatureCodes: new Set(),
    permissions: { canUse: () => true },
    reportFeatureError: async () => undefined,
    saveRuntimeState: async () => undefined,
    wallet: {} as FeatureContext["wallet"],
    robux: {} as FeatureContext["robux"],
    memberSpending: {} as FeatureContext["memberSpending"],
  };
}
function interaction(
  options: {
    autocomplete?: boolean;
    name?: string;
    set?: string;
    guild?: string;
    sendError?: boolean;
    unavailableChannel?: boolean;
    confirmationError?: boolean;
  } = {},
) {
  const replies: Record<string, unknown>[] = [];
  const suggestions: unknown[] = [];
  const sent: Record<string, unknown>[] = [];
  const edits: Record<string, unknown>[] = [];
  const deferrals: Record<string, unknown>[] = [];
  const events: string[] = [];
  const value = {
    commandName: options.name ?? "info",
    guildId: options.guild ?? "guild",
    channelId: "channel",
    channel: options.unavailableChannel
      ? null
      : {
          isSendable: () => true,
          send: async (payload: Record<string, unknown>) => {
            events.push("send");
            if (options.sendError)
              throw new Error("Missing Send Messages permission");
            sent.push(payload);
          },
        },
    guild: { name: "Server" },
    user: { id: "user", displayName: "Alice" },
    replied: false,
    deferred: false,
    inGuild: () => true,
    isAutocomplete: () => !!options.autocomplete,
    isChatInputCommand: () => !options.autocomplete,
    options: {
      getFocused: () => options.set ?? "",
      getString: () => options.set ?? "Rules",
    },
    respond: async (choices: unknown[]) => {
      suggestions.push(...choices);
    },
    reply: async (payload: Record<string, unknown>) => {
      value.replied = true;
      replies.push(payload);
    },
    deferReply: async (payload: Record<string, unknown>) => {
      value.deferred = true;
      events.push("defer");
      deferrals.push(payload);
    },
    editReply: async (payload: Record<string, unknown>) => {
      if (options.confirmationError)
        throw new Error("Confirmation unavailable");
      value.replied = true;
      events.push("edit");
      edits.push(payload);
    },
  };
  return {
    value: value as unknown as Interaction,
    replies,
    suggestions,
    sent,
    edits,
    deferrals,
    events,
  };
}
test("enforces 20 SETs and unique names/slots", () => {
  assert.equal(
    readMessageSets(
      Array.from({ length: 20 }, (_, i) => ({
        name: `SET ${i}`,
        presentationSlot: `set_${i + 1}`,
      })),
    ).length,
    20,
  );
  assert.throws(() =>
    readMessageSets(
      Array.from({ length: 21 }, (_, i) => ({
        name: `SET ${i}`,
        presentationSlot: `set_${i + 1}`,
      })),
    ),
  );
  assert.throws(() =>
    readMessageSets([
      { name: "Rules", presentationSlot: "set_1" },
      { name: "rules", presentationSlot: "set_2" },
    ]),
  );
});
test("autocomplete and sends follow live edits, deletion and command rename without listener duplication", async () => {
  const client = new FakeClient();
  client.ready = true;
  const dispose = await messageSetsFeature.activate(context(client));
  const initial = interaction();
  client.emit("interactionCreate", initial.value);
  await settle();
  assert.deepEqual(initial.sent[0]?.embeds, [
    { title: "Rules", description: "Original" },
  ]);
  assert.deepEqual(initial.deferrals, [{ flags: MessageFlags.Ephemeral }]);
  assert.equal(initial.replies.length, 0);
  assert.deepEqual(initial.edits, [
    { content: "ส่ง SET แล้ว", allowedMentions: { parse: [] } },
  ]);
  assert.deepEqual(initial.events, ["defer", "send", "edit"]);
  const next = feature([{ name: "Prices", presentationSlot: "set_1" }]);
  next.presentations = {
    set_1: {
      mode: "COMPONENTS_V2",
      components_v2: {
        components: [
          {
            type: 17,
            accent_color: "#ff00ff",
            components: [{ type: 10, content: "{{set_name}}" }],
          },
        ],
      },
    },
  };
  await dispose.update!(next);
  const auto = interaction({ autocomplete: true, set: "pri" });
  client.emit("interactionCreate", auto.value);
  await settle();
  assert.deepEqual(auto.suggestions, [{ name: "Prices", value: "Prices" }]);
  const send = interaction({ set: "Prices" });
  client.emit("interactionCreate", send.value);
  await settle();
  assert.equal(send.sent[0]?.flags, MessageFlags.IsComponentsV2);
  assert.deepEqual(send.deferrals, [{ flags: MessageFlags.Ephemeral }]);
  assert.equal(send.replies.length, 0);
  assert.equal(send.edits[0]?.embeds, undefined);
  assert.equal(send.edits[0]?.components, undefined);
  assert.equal(send.sent[0]?.embeds, undefined);
  assert.deepEqual(send.sent[0]?.allowedMentions, { parse: [] });
  const stale = interaction();
  client.emit("interactionCreate", stale.value);
  await settle();
  assert.equal(stale.replies[0]?.flags, MessageFlags.Ephemeral);
  await dispose.update!({
    ...next,
    config: { MESSAGE_SETS_COMMAND_NAME: "menu", MESSAGE_SETS: [] },
  });
  assert.deepEqual(client.deleted, ["info"]);
  assert.equal(client.registrations.length, 2);
  const empty = interaction({ autocomplete: true, name: "menu" });
  client.emit("interactionCreate", empty.value);
  await settle();
  assert.deepEqual(empty.suggestions, []);
  assert.equal(client.listenerCount("interactionCreate"), 1);
  await dispose();
  assert.equal(client.listenerCount("interactionCreate"), 0);
});
test("permission and guild checks prevent unauthorized posting", async () => {
  const client = new FakeClient();
  const c = context(client);
  c.permissions.canUse = () => false;
  const dispose = await messageSetsFeature.activate(c);
  const denied = interaction();
  client.emit("interactionCreate", denied.value);
  await settle();
  assert.equal(denied.replies[0]?.flags, MessageFlags.Ephemeral);
  assert.equal(denied.sent.length, 0);
  const otherGuild = interaction({ guild: "other" });
  client.emit("interactionCreate", otherGuild.value);
  await settle();
  assert.equal(otherGuild.replies.length, 0);
  assert.equal(otherGuild.sent.length, 0);
  await dispose();
});
test("BotManager preserves the Discord client for SET updates and restarts for explicit restart", async () => {
  const clients: FakeClient[] = [];
  const api = { reportStatus: async () => undefined } as unknown as RuntimeApi;
  const manager = new BotManager(api, () => {
    const c = new FakeClient();
    clients.push(c);
    return c as unknown as Client;
  });
  const original = bot();
  await manager.reconcile([original]);
  await settle();
  const next = structuredClone(original);
  next.features[0]!.configRevision++;
  next.features[0]!.config.MESSAGE_SETS = [
    { name: "News", presentationSlot: "set_1" },
  ];
  assert.notEqual(makeFingerprint(original), makeFingerprint(next));
  assert.equal(makeRestartFingerprint(original), makeRestartFingerprint(next));
  await manager.reconcile([next]);
  assert.equal(clients.length, 1);
  assert.equal(clients[0]!.destroyed, false);
  const auto = interaction({ autocomplete: true });
  clients[0]!.emit("interactionCreate", auto.value);
  await settle();
  assert.deepEqual(auto.suggestions, [{ name: "News", value: "News" }]);
  await manager.reconcile([{ ...next, restartRevision: 1 }]);
  assert.equal(clients.length, 2);
  assert.equal(clients[0]!.destroyed, true);
  await manager.shutdown();
});
test("supervisor updates the existing worker over IPC and waits for acknowledgment", async () => {
  class Child extends EventEmitter {
    connected = true;
    sent: Array<{ type: string; bot?: RuntimeBot }> = [];
    send(message: { type: string; bot?: RuntimeBot }) {
      this.sent.push(message);
      if (message.type === "shutdown")
        setImmediate(() => this.emit("exit", 0, null));
    }
    kill() {}
  }
  const children: Child[] = [];
  const factory = (() => {
    const child = new Child();
    children.push(child);
    return child;
  }) as unknown as typeof fork;
  const manager = new ProcessBotManager(
    { reportStatus: async () => undefined } as unknown as RuntimeApi,
    {},
    factory,
  );
  const original = bot();
  await manager.reconcile([original]);
  const next = structuredClone(original);
  next.features[0]!.config.MESSAGE_SETS = [];
  next.features[0]!.configRevision++;
  await manager.reconcile([next]);
  assert.equal(children.length, 1);
  assert.equal(children[0]!.sent[1]?.type, "update");
  manager.retryUpdates();
  assert.equal(children[0]!.sent.length, 3); // Retry even when bootstrap returns 304.
  children[0]!.emit("message", {
    type: "updated",
    fingerprint: makeFingerprint(next),
  });
  await settle();
  await manager.reconcile([next]);
  assert.equal(children[0]!.sent.length, 3);
  await manager.reconcile([{ ...next, restartRevision: 1 }]);
  assert.equal(children.length, 2);
  await manager.shutdown();
});

test("cannot overwrite another feature's command and preserves the last working SET snapshot", async () => {
  const client = new FakeClient();
  client.ready = true;
  const dispose = await messageSetsFeature.activate(context(client));
  client.registrations.push({ name: "wallet" });
  const next = feature([{ name: "New", presentationSlot: "set_1" }]);
  next.config.MESSAGE_SETS_COMMAND_NAME = "wallet";
  await assert.rejects(dispose.update!(next), /already owned/);
  const original = interaction();
  client.emit("interactionCreate", original.value);
  await settle();
  assert.deepEqual(original.sent[0]?.embeds, [
    { title: "Rules", description: "Original" },
  ]);
  assert.deepEqual(client.deleted, []);
  await dispose();
});

test("a saved command ID permits startup and removes the previous name after an offline rename", async () => {
  const client = new FakeClient();
  client.ready = true;
  client.registrations.push({ name: "old-name" });
  const c = context(client);
  c.runtimeState = { commandId: "old-name", commandName: "old-name" };
  const states: unknown[] = [];
  c.saveRuntimeState = async (state) => {
    states.push(state);
  };
  const dispose = await messageSetsFeature.activate(c);
  assert.deepEqual(client.deleted, ["old-name"]);
  assert.deepEqual(states[0], { commandId: "info", commandName: "info" });
  await dispose();
});

test("channel send failures produce only a private error after deferring", async () => {
  const client = new FakeClient();
  const errors: string[] = [];
  const c = context(client);
  c.reportFeatureError = async (code) => {
    errors.push(code);
  };
  const dispose = await messageSetsFeature.activate(c);
  const failed = interaction({ sendError: true });
  client.emit("interactionCreate", failed.value);
  await settle();
  assert.deepEqual(failed.deferrals, [{ flags: MessageFlags.Ephemeral }]);
  assert.equal(failed.sent.length, 0);
  assert.equal(failed.replies.length, 0);
  assert.equal(
    failed.edits[0]?.content,
    "ส่ง SET ไม่สำเร็จ กรุณาตรวจสอบดีไซน์และสิทธิ์ของบอท",
  );
  assert.deepEqual(errors, ["MESSAGE_SET_SEND_FAILED"]);
  await dispose();
});

test("unavailable channels produce a private error without posting", async () => {
  const client = new FakeClient();
  const dispose = await messageSetsFeature.activate(context(client));
  const unavailable = interaction({ unavailableChannel: true });
  client.emit("interactionCreate", unavailable.value);
  await settle();
  assert.equal(unavailable.sent.length, 0);
  assert.equal(unavailable.deferrals.length, 0);
  assert.equal(unavailable.replies[0]?.flags, MessageFlags.Ephemeral);
  await dispose();
});

test("a private confirmation failure never retries or reports a successful SET as failed", async () => {
  const client = new FakeClient();
  const errors: string[] = [];
  const c = context(client);
  c.reportFeatureError = async (code) => {
    errors.push(code);
  };
  const dispose = await messageSetsFeature.activate(c);
  const failedConfirmation = interaction({ confirmationError: true });
  client.emit("interactionCreate", failedConfirmation.value);
  await settle();
  assert.equal(failedConfirmation.sent.length, 1);
  assert.equal(failedConfirmation.replies.length, 0);
  assert.deepEqual(errors, ["MESSAGE_SET_ACK_FAILED"]);
  await dispose();
});
