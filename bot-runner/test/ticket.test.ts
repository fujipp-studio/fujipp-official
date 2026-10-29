import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ChannelType, Collection, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import type { FeatureContext } from "../src/types.js";
import { ticketFeature } from "../src/features/ticket/v1.0.0.js";
import { getFeature } from "../src/feature-registry.js";
import { readTicketConfig, readTicketTopic, ticketTopic, ticketDue, type TicketCategory, type TicketState } from "../src/features/ticket/config.js";

const owner = "111111111111111111", staff = "222222222222222222", serverId = "333333333333333333";
const parentId = "444444444444444444", botId = "555555555555555555", stranger = "666666666666666666";
const installation = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const prefix = `ticket:${installation}:`;
const category = (extra: Partial<TicketCategory> = {}): TicketCategory => ({
  key: "order", label: "สั่งซื้อ", description: "Order", categoryId: parentId, supportRoleIds: [staff],
  autoCloseMinutes: 60, autoCloseMode: "IDLE", formEnabled: true, formTitle: "สั่งซื้อ",
  fields: [{ key: "product", label: "สินค้า", style: "SHORT", required: true, placeholder: "" }], ...extra,
});
const state = (extra: Partial<TicketState> = {}): TicketState => ({ ownerId: owner, categoryKey: "order", openedAt: Date.now() - 7200_000, autoCloseMinutes: 60, autoCloseMode: "IDLE", supportRoleIds: [staff], status: "OPEN", ...extra });
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

function fixture(rows = [category()], historyEnabled = false) {
  const client: any = new EventEmitter();
  const channels = new Collection<string, any>();
  const creations: any[] = [], overwrites: any[] = [], errors: any[] = [], saves: any[] = [], commands = new Collection<string, any>();
  let latest = Date.now(), historyFails = false, permissionsFail = false, sendsFail = false;
  const makeChannel = (id: string, topic: string | null = null) => {
    const channel: any = { id, name: "ticket-order", type: ChannelType.GuildText, topic, sent: [],
      permissionsFor: (member: any) => ({ has: () => member.id !== stranger }),
      isSendable: () => true, isDMBased: () => false, fetch: async () => channel,
      setTopic: async (next: string) => { channel.topic = next; return channel; },
      permissionOverwrites: { edit: async (id: string, patch: unknown) => { if (permissionsFail) throw Error("Permission failure"); overwrites.push({ id, patch }); } },
      messages: { fetch: async () => { if (historyFails) throw Error("History unavailable"); return new Collection([["last", { createdTimestamp: latest }]]); } },
      send: async (payload: any) => { if (sendsFail) throw Error("Send failure"); channel.sent.push(payload); return { id: "message" }; },
    };
    channels.set(id, channel);
    return channel;
  };
  const panel = makeChannel("777777777777777777");
  channels.set(parentId, { id: parentId, type: ChannelType.GuildCategory, permissionsFor: () => ({ has: () => true }) });
  const server = { id: serverId,
    roles: { everyone: { id: serverId }, fetch: async (id: string) => ({ id }) },
    members: { me: { id: botId }, fetch: async ({ user }: { user: string }) => ({
      permissions: new PermissionsBitField(), roles: { cache: new Collection(user === staff ? [[staff, {}]] : []) },
    }) },
    channels: {
      fetch: async (id?: string) => id ? channels.get(id) : channels,
      create: async (options: any) => { creations.push(options); return makeChannel(`88888888888888888${creations.length}`, options.topic); },
    },
  };
  client.guilds = { fetch: async () => server };
  client.user = { id: botId };
  client.isReady = () => true;
  client.application = { commands: {
    fetch: async () => commands,
    create: async (data: any) => { const cmd = { ...data, id: "command" }; commands.set(cmd.id, cmd); return cmd; },
    delete: async (id: string) => commands.delete(id),
  } };
  const context = {
    client, guildId: serverId, installationId: installation, runtimeState: {},
    config: { TICKET_COMMAND_NAME: "ticket", TICKET_CATEGORIES: rows, TICKET_DISCORD_HISTORY_ENABLED: historyEnabled },
    presentations: {
      panel: { mode: "COMPONENTS_V2", components_v2: { components: [{ type: 10, content: "Tickets" }] } },
      opened: { mode: "EMBED", embed: { title: "{{category}}", description: "{{user}} {{auto_close}}" } },
    },
    permissions: { canUse: (i: any) => i.user.id === staff },
    saveRuntimeState: async (value: any) => { saves.push(value); },
    reportFeatureError: async (...args: any[]) => { errors.push(args); },
  } as unknown as FeatureContext;
  function interaction(kind: "select" | "modal" | "button" | "command", options: any = {}) {
    const replies: any[] = [];
    const value: any = {
      guildId: serverId, channelId: panel.id, user: { id: owner, displayName: "Alice" },
      customId: `${prefix}${kind === "select" ? "select" : kind === "modal" ? "form:order" : "close"}`,
      commandName: "ticket", commandId: "command", options: { getSubcommand: () => "panel" },
      values: ["order"], message: { author: { id: botId } },
      fields: { getTextInputValue: () => "VIP @everyone" },
      isChatInputCommand: () => kind === "command", isStringSelectMenu: () => kind === "select",
      isModalSubmit: () => kind === "modal", isButton: () => kind === "button",
      reply: async (payload: any) => { value.replied = true; replies.push(payload); },
      editReply: async (payload: any) => { replies.push(payload); },
      deferReply: async () => { value.deferred = true; }, deferUpdate: async () => { value.deferred = true; },
      showModal: async (modal: any) => { value.modal = modal.toJSON(); },
      ...options,
    };
    return { value, replies, send: async () => { client.emit("interactionCreate", value); await flush(); } };
  }
  return { context, client, channels, panel, creations, overwrites, errors, saves, commands, makeChannel, interaction,
    setLatest: (time: number) => { latest = time; }, failHistory: () => { historyFails = true; },
    failPermissions: (value: boolean) => { permissionsFail = value; }, failSends: () => { sendsFail = true; } };
}

test("validates category and form limits, duplicate keys and timer types", () => {
  assert.equal(readTicketConfig({ TICKET_CATEGORIES: [category()] }).categories.length, 1);
  for (const rows of [[], [category(), category()], [category({ fields: [] })], [category({ autoCloseMinutes: -1 })],
    [category({ autoCloseMinutes: 0.5 })], [category({ supportRoleIds: [staff, staff] })],
    [category({ categoryId: "" })], [category({ fields: Array(6).fill(category().fields[0]) })]])
    assert.throws(() => readTicketConfig({ TICKET_CATEGORIES: rows }));
  assert.doesNotThrow(() => readTicketConfig({ TICKET_CATEGORIES: [category({ formEnabled: false, fields: [], autoCloseMinutes: 0 })] }));
});

test("catalog defaults match the bundled runtime and enable both requested forms", () => {
  const migration = readFileSync(new URL("../../supabase/migrations/20261029000002_create_ticket_feature.sql", import.meta.url), "utf8");
  const raw = migration.match(/'JSON', true, false, '([^']+)'::jsonb/);
  assert.ok(raw);
  const categories = JSON.parse(raw[1]!) as TicketCategory[];
  assert.deepEqual(categories.map((row) => row.label), ["สั่งซื้อ", "แจ้งปัญหา"]);
  assert.equal(categories.every((row) => row.formEnabled && row.fields.length > 0), true);
  assert.equal(categories.every((row) => row.autoCloseMinutes === 0), true);
  for (const row of categories) row.categoryId = parentId;
  assert.doesNotThrow(() => readTicketConfig({ TICKET_CATEGORIES: categories }));
  assert.equal(getFeature("ticket", "1.0.0"), ticketFeature);
});

test("topic state is isolated per installation and rejects malformed state", () => {
  const value = state();
  const topic = ticketTopic(installation, value);
  assert.deepEqual(readTicketTopic(installation, topic), value);
  assert.equal(readTicketTopic("another-installation", topic), null);
  assert.equal(readTicketTopic(installation, "normal room topic"), null);
  assert.equal(readTicketTopic(installation, `fujipp-ticket:${installation}:{}`), null);
});

test("fixed, idle and disabled deadlines handle the exact boundary", () => {
  const openedAt = 1_000_000, now = openedAt + 60_000;
  assert.equal(ticketDue(state({ openedAt, autoCloseMinutes: 1, autoCloseMode: "OPENED" }), now, now), true);
  assert.equal(ticketDue(state({ openedAt, autoCloseMinutes: 1 }), now, now), false);
  assert.equal(ticketDue(state({ openedAt, autoCloseMinutes: 1 }), openedAt, now - 1), false);
  assert.equal(ticketDue(state({ openedAt, autoCloseMinutes: 0 }), openedAt, now), false);
  assert.equal(ticketDue(state({ openedAt, autoCloseMinutes: 1, status: "CLOSED" }), openedAt, now), false);
});

test("dropdown shows a modal before creating a ticket and submits private answers", async (t) => {
  const f = fixture(); t.after(await ticketFeature.activate(f.context)); await flush();
  const select = f.interaction("select"); await select.send();
  assert.equal(f.creations.length, 0);
  assert.equal(select.value.modal.components[0].type, 18);
  assert.equal(select.value.modal.components[0].component.required, true);
  const modal = f.interaction("modal"); await modal.send();
  assert.equal(f.creations.length, 1);
  const created = f.creations[0];
  assert.equal(created.parent, parentId);
  assert.deepEqual(created.permissionOverwrites[0], { id: serverId, deny: [PermissionFlagsBits.ViewChannel] });
  assert.equal(created.permissionOverwrites.some((row: any) => row.id === staff), true);
  const room = f.channels.get("888888888888888881");
  assert.match(JSON.stringify(room.sent), /VIP @everyone/);
  assert.deepEqual(room.sent[0].allowedMentions, { parse: [] });
  assert.match(modal.replies.at(-1).content, /888888888888888881/);
});

test("topics without forms open directly and concurrent clicks share one ticket", async (t) => {
  const f = fixture([category({ formEnabled: false, fields: [] })]); t.after(await ticketFeature.activate(f.context)); await flush();
  const a = f.interaction("select"), b = f.interaction("select");
  await Promise.all([a.send(), b.send()]);
  assert.equal(f.creations.length, 1);
  assert.match(b.replies.at(-1).content, /อยู่แล้ว/);
});

test("empty required answers and stale topics never create channels", async (t) => {
  const f = fixture(); t.after(await ticketFeature.activate(f.context)); await flush();
  const a = f.interaction("modal", { fields: { getTextInputValue: () => "  " } }); await a.send();
  const b = f.interaction("select", { values: ["deleted"] }); await b.send();
  assert.equal(f.creations.length, 0);
  assert.equal(a.replies[0].embeds.length, 1);
  assert.equal(b.replies[0].embeds.length, 1);
});

test("panel posting requires permission and appends a live dropdown", async (t) => {
  const f = fixture(); t.after(await ticketFeature.activate(f.context)); await flush();
  const denied = f.interaction("command"); await denied.send();
  assert.equal(f.panel.sent.length, 0);
  const allowed = f.interaction("command", { user: { id: staff } }); await allowed.send();
  const menu = f.panel.sent[0].components.at(-1).toJSON().components[0];
  assert.equal(menu.type, 3); assert.equal(menu.options[0].value, "order");
});

test("strangers cannot close a ticket; the opener confirms before the write lock", async (t) => {
  const f = fixture(); const room = f.makeChannel("999999999999999999", ticketTopic(installation, state()));
  t.after(await ticketFeature.activate(f.context)); await flush();
  const denied = f.interaction("button", { channelId: room.id, user: { id: stranger } }); await denied.send();
  assert.equal(f.overwrites.length, 0);
  const request = f.interaction("button", { channelId: room.id }); await request.send();
  assert.equal(f.overwrites.length, 0);
  const confirm = f.interaction("button", { channelId: room.id, customId: `${prefix}confirm-close` }); await confirm.send();
  assert.equal(f.overwrites[0].id, owner);
  assert.equal(f.overwrites[0].patch.SendMessages, false);
  assert.equal(f.overwrites[0].patch.SendMessagesInThreads, false);
  assert.equal(readTicketTopic(installation, room.topic)?.status, "CLOSED");
});

test("startup restores deadlines, keeps active idle tickets and ignores unrelated rooms", async (t) => {
  const f = fixture();
  const idle = f.makeChannel("999999999999999991", ticketTopic(installation, state()));
  const fixed = f.makeChannel("999999999999999992", ticketTopic(installation, state({ autoCloseMode: "OPENED" })));
  const unrelated = f.makeChannel("999999999999999993", ticketTopic("other", state({ autoCloseMode: "OPENED" })));
  t.after(await ticketFeature.activate(f.context)); await flush();
  assert.equal(readTicketTopic(installation, idle.topic)?.status, "OPEN");
  assert.equal(readTicketTopic(installation, fixed.topic)?.status, "CLOSED");
  assert.equal(unrelated.sent.length, 0);
});

test("failed history reads never close idle tickets and partial closes resume on restart", async (t) => {
  const f = fixture();
  const idle = f.makeChannel("999999999999999991", ticketTopic(installation, state()));
  const closing = f.makeChannel("999999999999999992", ticketTopic(installation, state({ status: "CLOSING" })));
  f.failHistory();
  t.after(await ticketFeature.activate(f.context)); await flush();
  assert.equal(readTicketTopic(installation, idle.topic)?.status, "OPEN");
  assert.equal(readTicketTopic(installation, closing.topic)?.status, "CLOSED");
  assert.equal(f.errors[0][0], "TICKET_AUTO_CLOSE_FAILED");
});

test("the periodic sweep closes idle tickets when their deadline arrives", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: Date.now() });
  const f = fixture();
  const room = f.makeChannel("999999999999999999", ticketTopic(installation, state({ openedAt: Date.now(), autoCloseMinutes: 1 })));
  t.after(await ticketFeature.activate(f.context)); await flush();
  assert.equal(readTicketTopic(installation, room.topic)?.status, "OPEN");
  t.mock.timers.tick(60_001); await flush();
  assert.equal(readTicketTopic(installation, room.topic)?.status, "CLOSED");
});

test("failed closing records retryable intent and shutdown removes listeners", async () => {
  const f = fixture();
  const room = f.makeChannel("999999999999999999", ticketTopic(installation, state({ autoCloseMode: "OPENED" })));
  f.failPermissions(true);
  const dispose = await ticketFeature.activate(f.context); await flush();
  assert.equal(readTicketTopic(installation, room.topic)?.status, "CLOSING");
  await dispose();
  assert.equal(f.client.listenerCount("interactionCreate"), 0);
  f.failPermissions(false);
  const restarted = await ticketFeature.activate({ ...f.context, runtimeState: f.saves.at(-1) }); await flush();
  assert.equal(readTicketTopic(installation, room.topic)?.status, "CLOSED");
  await restarted();
});

test("Discord history stays off by default and rejects stale history buttons", async (t) => {
  const f = fixture(); const room = f.makeChannel("999999999999999999", ticketTopic(installation, state({ autoCloseMinutes: 0 })));
  t.after(await ticketFeature.activate(f.context)); await flush();
  assert.equal([...f.commands.values()][0].options.some((item: any) => item.name === "history"), false);
  const i = f.interaction("button", { channelId: room.id, customId: `${prefix}history` }); await i.send();
  assert.match(i.replies.at(-1).embeds[0].description, /ปิดการอ่านประวัติ/);
  assert.equal(i.replies.some((item) => item.files), false);
});

test("enabled history allows a private download from a closed ticket and denies strangers", async (t) => {
  const f = fixture([category()], true); const room = f.makeChannel("999999999999999999", ticketTopic(installation, state({ status: "CLOSED" })));
  room.messages.fetch = async () => new Collection();
  t.after(await ticketFeature.activate(f.context)); await flush();
  assert.equal([...f.commands.values()][0].options.some((item: any) => item.name === "history"), true);
  const allowed = f.interaction("button", { channelId: room.id, customId: `${prefix}history` }); await allowed.send();
  assert.equal(allowed.value.deferred, true);
  assert.equal(allowed.replies.at(-1).files[0].name, `ticket-${room.id}.txt`);
  const denied = f.interaction("button", { channelId: room.id, customId: `${prefix}history`, user: { id: stranger } }); await denied.send();
  assert.equal(denied.replies.some((item) => item.files), false);
  assert.match(denied.replies.at(-1).embeds[0].description, /ไม่มีสิทธิ์/);
  room.permissionsFor = () => ({ has: () => false });
  const revoked = f.interaction("button", { channelId: room.id, customId: `${prefix}history` }); await revoked.send();
  assert.equal(revoked.replies.some((item) => item.files), false);
  assert.match(revoked.replies.at(-1).embeds[0].description, /ไม่มีสิทธิ์/);
});
