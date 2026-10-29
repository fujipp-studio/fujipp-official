import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ApplicationFlagsBitField, ChannelType, Collection, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import type { FeatureContext } from "../src/types.js";
import { ticketFeature } from "../src/features/ticket/v1.0.0.js";
import { getFeature } from "../src/feature-registry.js";
import { readTicketConfig, readTicketTopic, ticketTopic, ticketDue, ticketChannelName, type TicketCategory, type TicketState } from "../src/features/ticket/config.js";

const owner = "111111111111111111", staff = "222222222222222222", serverId = "333333333333333333";
const parentId = "444444444444444444", botId = "555555555555555555", stranger = "666666666666666666";
const administrator = "777777777777777778";
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
  const records = new Map<string, { channelId: string; name: string; state: TicketState; archived: boolean }>();
  const archives: any[] = [], deleted: string[] = [];
  let archiveFails = false, deleteFails = false, registryFails = false, readAllowed = true, intentEnabled = true;
  let latest = Date.now(), historyFails = false, permissionsFail = false, sendsFail = false;
  const makeChannel = (id: string, topic: string | null = null) => {
    const channel: any = { id, name: "ticket-order", type: ChannelType.GuildText, topic, sent: [],
      permissionsFor: (member: any) => ({ has: () => member.id !== stranger && (member.id !== botId || readAllowed) }),
      isSendable: () => true, isDMBased: () => false, fetch: async () => channel,
      setTopic: async (next: string | null) => { channel.topic = next; return channel; },
      delete: async () => { if (deleteFails) throw Error("Delete failure"); assert.equal(records.get(id)?.archived, true); deleted.push(id); channels.delete(id); },
      permissionOverwrites: { edit: async (id: string, patch: unknown) => { if (permissionsFail) throw Error("Permission failure"); overwrites.push({ id, patch }); } },
      messages: { fetch: async (options: any) => { if (historyFails) throw Error("History unavailable"); return options.limit === 1 ? new Collection([["last", { createdTimestamp: latest }]]) : new Collection(); } },
      send: async (payload: any) => { if (sendsFail) throw Error("Send failure"); channel.sent.push(payload); return { id: "message" }; },
    };
    channels.set(id, channel);
    return channel;
  };
  const panel = makeChannel("777777777777777777");
  channels.set(parentId, { id: parentId, type: ChannelType.GuildCategory, permissionsFor: () => ({ has: () => true }) });
  const server = { id: serverId,
    roles: { everyone: { id: serverId }, fetch: async (id: string) => ({ id }) },
    members: { me: { id: botId }, fetchMe: async () => ({ id: botId }), fetch: async ({ user }: { user: string }) => ({
      permissions: new PermissionsBitField(user === administrator ? [PermissionFlagsBits.Administrator] : []), roles: { cache: new Collection(user === staff ? [[staff, {}]] : []) },
    }) },
    channels: {
      fetch: async (id?: string) => id ? channels.get(id) : channels,
      create: async (options: any) => { creations.push(options); return makeChannel(`88888888888888888${creations.length}`, options.topic); },
    },
  };
  client.guilds = { fetch: async () => server };
  client.user = { id: botId };
  client.isReady = () => true;
  client.application = { fetch: async () => ({ flags: new ApplicationFlagsBitField(intentEnabled ? ApplicationFlagsBitField.Flags.GatewayMessageContentLimited : 0) }), commands: {
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
    tickets: {
      list: async () => [...records.values()].map(entry => structuredClone(entry)),
      save: async (channelId: string, name: string, value: TicketState) => { if (registryFails) throw Error("Registry unavailable"); records.set(channelId, { channelId, name, state: structuredClone(value), archived: records.get(channelId)?.archived ?? false }); },
      archive: async (channelId: string, messages: unknown[]) => { if (archiveFails) throw Error("Archive unavailable"); records.get(channelId)!.archived = true; archives.push({ channelId, messages }); },
    },
    saveRuntimeState: async (value: any) => { saves.push(value); },
    reportFeatureError: async (...args: any[]) => { errors.push(args); },
  } as unknown as FeatureContext;
  function interaction(kind: "select" | "modal" | "button" | "command", options: any = {}) {
    const replies: any[] = [];
    const value: any = {
      guildId: serverId, channelId: panel.id, user: { id: owner, displayName: "Alice", username: "Alice" },
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
  return { context, client, channels, panel, creations, overwrites, errors, saves, commands, makeChannel, interaction, records, archives, deleted,
    allowArchiveRead: (value: boolean) => { readAllowed = value; }, enableContentIntent: (value: boolean) => { intentEnabled = value; }, failRegistry: (value: boolean) => { registryFails = value; }, failArchive: () => { archiveFails = true; }, failDelete: (value: boolean) => { deleteFails = value; },
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

test("unconfigured catalog topics explain where to set Discord category IDs", () => {
  assert.throws(() => readTicketConfig({ TICKET_CATEGORIES: [category({ categoryId: "" })] }),
    /Configure the Discord Category ID.*bot settings/);
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
  assert.ok(room.sent[0].embeds);
  assert.equal(created.topic, undefined);
  assert.deepEqual(room.sent[0].allowedMentions, { parse: [] });
  assert.match(modal.replies.at(-1).content, /888888888888888881/);
});

test("topics without forms open directly and concurrent clicks share one ticket", async (t) => {
  const f = fixture([category({ formEnabled: false, fields: [] })]); t.after(await ticketFeature.activate(f.context)); await flush();
  const a = f.interaction("select"), b = f.interaction("select");
  await Promise.all([a.send(), b.send()]);
  assert.equal(f.creations.length, 1);
  assert.match(b.replies.at(-1).content, /สูงสุด 1/);
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
  const f = fixture([category({ emoji: "<:cart:123456789012345678>" })]); t.after(await ticketFeature.activate(f.context)); await flush();
  const denied = f.interaction("command"); await denied.send();
  assert.equal(f.panel.sent.length, 0);
  const allowed = f.interaction("command", { user: { id: staff } }); await allowed.send();
  const menu = f.panel.sent[0].components.at(-1).toJSON().components[0];
  assert.equal(menu.type, 3); assert.equal(menu.options[0].value, "order");
  assert.equal(menu.options[0].emoji.id, "123456789012345678");
});

test("only administrators close by default, with confirmation before archiving and deletion", async (t) => {
  const f = fixture(); const room = f.makeChannel("999999999999999999", ticketTopic(installation, state()));
  t.after(await ticketFeature.activate(f.context)); await flush();
  const denied = f.interaction("button", { channelId: room.id, user: { id: stranger } }); await denied.send();
  assert.equal(f.overwrites.length, 0);
  const opener = f.interaction("button", { channelId: room.id }); await opener.send();
  assert.equal(f.archives.length, 0);
  const request = f.interaction("button", { channelId: room.id, user: { id: administrator } }); await request.send();
  assert.equal(f.overwrites.length, 0);
  const confirm = f.interaction("button", { channelId: room.id, user: { id: administrator }, customId: `${prefix}confirm-close` }); await confirm.send();
  assert.equal(f.overwrites[0].id, owner);
  assert.equal(f.overwrites[0].patch.SendMessages, false);
  assert.equal(f.overwrites[0].patch.SendMessagesInThreads, false);
  assert.equal(f.records.get(room.id)?.state.status, "CLOSED");
});

test("startup restores deadlines, keeps active idle tickets and ignores unrelated rooms", async (t) => {
  const f = fixture();
  const idle = f.makeChannel("999999999999999991", ticketTopic(installation, state()));
  const fixed = f.makeChannel("999999999999999992", ticketTopic(installation, state({ autoCloseMode: "OPENED" })));
  const unrelated = f.makeChannel("999999999999999993", ticketTopic("other", state({ autoCloseMode: "OPENED" })));
  t.after(await ticketFeature.activate(f.context)); await flush();
  assert.equal(f.records.get(idle.id)?.state.status, "OPEN");
  assert.equal(f.records.get(fixed.id)?.state.status, "CLOSED");
  assert.ok(f.deleted.includes(fixed.id));
  assert.equal(idle.topic, null);
  assert.equal(unrelated.sent.length, 0);
});

test("failed history reads never close idle tickets and partial closes resume on restart", async (t) => {
  const f = fixture();
  const idle = f.makeChannel("999999999999999991", ticketTopic(installation, state()));
  const closing = f.makeChannel("999999999999999992", ticketTopic(installation, state({ status: "CLOSING" })));
  f.failHistory();
  t.after(await ticketFeature.activate(f.context)); await flush();
  assert.equal(f.records.get(idle.id)?.state.status, "OPEN");
  assert.equal(f.records.get(closing.id)?.state.status, "CLOSING");
  assert.equal(f.deleted.length, 0);
  assert.equal(f.errors[0][0], "TICKET_AUTO_CLOSE_FAILED");
});

test("the periodic sweep closes idle tickets when their deadline arrives", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: Date.now() });
  const f = fixture();
  const room = f.makeChannel("999999999999999999", ticketTopic(installation, state({ openedAt: Date.now(), autoCloseMinutes: 1 })));
  t.after(await ticketFeature.activate(f.context)); await flush();
  assert.equal(f.records.get(room.id)?.state.status, "OPEN");
  t.mock.timers.tick(60_001); await flush();
  assert.equal(f.records.get(room.id)?.state.status, "CLOSED");
});

test("failed closing records retryable intent and shutdown removes listeners", async () => {
  const f = fixture();
  const room = f.makeChannel("999999999999999999", ticketTopic(installation, state({ autoCloseMode: "OPENED" })));
  f.failPermissions(true);
  const dispose = await ticketFeature.activate(f.context); await flush();
  assert.equal(f.records.get(room.id)?.state.status, "CLOSING");
  await dispose();
  assert.equal(f.client.listenerCount("interactionCreate"), 0);
  f.failPermissions(false);
  const restarted = await ticketFeature.activate({ ...f.context, runtimeState: f.saves.at(-1) }); await flush();
  assert.equal(f.records.get(room.id)?.state.status, "CLOSED");
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

test("validates close permissions, opening limits, custom emoji and safe name variables", () => {
  const behavior = { maxOpenPerUser: 2, confirmClose: false, closeRoleIds: [staff], closeUserIds: [stranger] };
  assert.equal(readTicketConfig({ TICKET_CATEGORIES: [category({ emoji: '<a:wave:111111111111111111>', channelNameTemplate: 'order-{{username}}-{{id}}' })], TICKET_BEHAVIOR: behavior }).behavior.maxOpenPerUser, 2);
  for (const invalid of [{ ...behavior, maxOpenPerUser: 0 }, { ...behavior, maxOpenPerUser: 1.5 }, { ...behavior, maxOpenPerUser: 26 }, { ...behavior, confirmClose: 'true' }, { ...behavior, closeRoleIds: [staff, staff] }, { ...behavior, closeUserIds: ['invalid'] }])
    assert.throws(() => readTicketConfig({ TICKET_CATEGORIES: [category()], TICKET_BEHAVIOR: invalid }));
  for (const patch of [{ emoji: '<script>' }, { emoji: 'plain text' }, { channelNameTemplate: '{{unknown}}' }, { channelNameTemplate: 'line\nline' }])
    assert.throws(() => readTicketConfig({ TICKET_CATEGORIES: [category(patch)] }));
  assert.equal(ticketChannelName('ซื้อ-{{username}}-{{topic}}-{{id}}', 'vip', { id: owner, username: 'Alice Smith' }, '123'), 'ซื้อ-alice-smith-vip-123');
  assert.ok(ticketChannelName('{{username}}', 'vip', { id: owner, username: '@everyone/#' }, '123').length > 0);
});

test("configured opening limits apply across topics and custom names have no system topic", async (t) => {
  const f = fixture([category({ formEnabled: false, fields: [], channelNameTemplate: 'order-{{username}}' }), category({ key: 'support', formEnabled: false, fields: [] })]);
  (f.context.config as any).TICKET_BEHAVIOR = { maxOpenPerUser: 2, confirmClose: true, closeRoleIds: [], closeUserIds: [] };
  t.after(await ticketFeature.activate(f.context)); await flush();
  await f.interaction('select').send();
  await f.interaction('select', { values: ['support'] }).send();
  const denied = f.interaction('select'); await denied.send();
  assert.equal(f.creations.length, 2);
  assert.equal(f.creations[0].name, 'order-alice');
  assert.equal(f.creations[0].topic, undefined);
  assert.match(denied.replies.at(-1).content, /สูงสุด 2/);
});

test("an explicit closing role or user can delete directly when confirmation is off", async (t) => {
  for (const actor of [staff, stranger]) {
    const f = fixture();
    (f.context.config as any).TICKET_BEHAVIOR = { maxOpenPerUser: 1, confirmClose: false, closeRoleIds: [staff], closeUserIds: [stranger] };
    const room = f.makeChannel('999999999999999999', ticketTopic(installation, state({ autoCloseMinutes: 0 })));
    t.after(await ticketFeature.activate(f.context)); await flush();
    assert.equal(room.topic, null);
    await f.interaction('button', { channelId: room.id, user: { id: actor } }).send();
    assert.deepEqual(f.deleted, [room.id]);
    assert.equal(f.archives.length, 1);
    assert.equal(f.records.get(room.id)?.state.status, 'CLOSED');
  }
});

test("archive failures keep rooms; a saved closing intent survives deletion failure and restart without topics", async (t) => {
  const f = fixture();
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state({ autoCloseMinutes: 0 })));
  f.failArchive();
  t.after(await ticketFeature.activate(f.context)); await flush();
  await f.interaction('button', { channelId: room.id, user: { id: administrator }, customId: `${prefix}confirm-close` }).send();
  assert.equal(f.deleted.length, 0);
  assert.equal(f.channels.has(room.id), true);
  assert.equal(f.records.get(room.id)?.state.status, 'CLOSING');
  assert.equal(f.records.get(room.id)?.archived, false);

  const g = fixture();
  const other = g.makeChannel('999999999999999998', ticketTopic(installation, state({ autoCloseMode: 'OPENED' })));
  g.failDelete(true);
  const stop = await ticketFeature.activate(g.context); await flush(); await stop();
  assert.equal(other.topic, null);
  assert.equal(g.records.get(other.id)?.state.status, 'CLOSING');
  assert.equal(g.records.get(other.id)?.archived, true);
  g.failDelete(false);
  t.after(await ticketFeature.activate({ ...g.context, runtimeState: g.saves.at(-1) })); await flush();
  assert.deepEqual(g.deleted, [other.id]);
  assert.equal(g.records.get(other.id)?.state.status, 'CLOSED');
});

test('legacy metadata is cleared only after durable registration succeeds', async t => {
  const f = fixture();
  const topic = ticketTopic(installation, state({ autoCloseMinutes: 0 }));
  const room = f.makeChannel('999999999999999999', topic);
  f.failRegistry(true);
  const stop = await ticketFeature.activate(f.context); await flush(); await stop();
  assert.equal(room.topic, topic);
  assert.equal(f.records.has(room.id), false);
  f.failRegistry(false);
  t.after(await ticketFeature.activate({ ...f.context, runtimeState: f.saves.at(-1) })); await flush();
  assert.equal(room.topic, null);
  assert.equal(f.records.get(room.id)?.state.status, 'OPEN');
});

test('missing read permission or Message Content Intent never archives empty content and deletes the room', async t => {
  for (const failure of ['permission', 'intent']) {
    const f = fixture();
    const room = f.makeChannel('999999999999999999', ticketTopic(installation, state({ autoCloseMinutes: 0 })));
    if (failure === 'permission') f.allowArchiveRead(false);
    else f.enableContentIntent(false);
    t.after(await ticketFeature.activate(f.context)); await flush();
    await f.interaction('button', { channelId: room.id, user: { id: administrator }, customId: `${prefix}confirm-close` }).send();
    assert.equal(f.deleted.length, 0);
    assert.equal(f.archives.length, 0);
    assert.equal(f.channels.has(room.id), true);
    assert.equal(f.records.get(room.id)?.state.status, 'CLOSING');
  }
});
