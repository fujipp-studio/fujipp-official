import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ApplicationFlagsBitField, ChannelType, Collection, OverwriteType, PermissionFlagsBits, PermissionsBitField } from "discord.js";
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
    const invited = new Set<string>();
    const channel: any = { id, name: "ticket-order", type: ChannelType.GuildText, topic, sent: [],
      permissionsFor: (member: any) => ({ has: () => (member.id !== stranger || invited.has(member.id)) && (member.id !== botId || readAllowed) }),
      isSendable: () => true, isDMBased: () => false, fetch: async () => channel,
      setTopic: async (next: string | null) => { channel.topic = next; return channel; },
      delete: async () => { if (deleteFails) throw Error("Delete failure"); assert.equal(records.get(id)?.archived, true); deleted.push(id); channels.delete(id); },
      permissionOverwrites: { edit: async (id: string, patch: any, options: unknown) => { if (permissionsFail) throw Error("Permission failure"); if (patch.ViewChannel) invited.add(id); overwrites.push({ id, patch, options }); } },
      messages: { fetch: async (options: any) => { if (historyFails) throw Error("History unavailable"); return options.limit === 1 ? new Collection([["last", { createdTimestamp: latest }]]) : new Collection(); } },
      send: async (payload: any) => { if (sendsFail) throw Error("Send failure"); channel.sent.push(payload); return { id: "message" }; },
    };
    channels.set(id, channel);
    return channel;
  };
  const panel = makeChannel("777777777777777777");
  channels.set(parentId, { id: parentId, type: ChannelType.GuildCategory, permissionsFor: () => ({ has: () => true }) });
  const server = { id: serverId,
    roles: { cache: new Collection([[staff,{id:staff}]]), everyone: { id: serverId }, fetch: async (id: string) => ({ id }) },
    members: { me: { id: botId }, fetchMe: async () => ({ id: botId }), fetch: async ({ user }: { user: string }) => ({
      id: user, user: { id: user, bot: user === botId },
      permissions: new PermissionsBitField(user === administrator ? [PermissionFlagsBits.Administrator] : []), roles: { cache: new Collection(user === staff ? [[staff, {}]] : []) },
    }) },
    channels: { cache: channels,
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
      nextNumber: async () => records.size,
      list: async () => [...records.values()].map(entry => structuredClone(entry)),
      save: async (channelId: string, name: string, value: TicketState) => { if (registryFails) throw Error("Registry unavailable"); records.set(channelId, { channelId, name, state: structuredClone(value), archived: records.get(channelId)?.archived ?? false }); },
      archive: async (channelId: string, messages: unknown[]) => { if (archiveFails) throw Error("Archive unavailable"); records.get(channelId)!.archived = true; archives.push({ channelId, messages }); },
    },
    saveRuntimeState: async (value: any) => { saves.push(value); },
    reportFeatureError: async (...args: any[]) => { errors.push(args); },
  } as unknown as FeatureContext;
  let interactionCount = 0;
  function interaction(kind: "select" | "user-select" | "modal" | "button" | "command", options: any = {}) {
    const replies: any[] = [];
    const value: any = {
      id: String(910000000000000000n + BigInt(++interactionCount)),
      guildId: serverId, channelId: panel.id, user: { id: owner, displayName: "Alice", username: "Alice" },
      customId: `${prefix}${kind === "select" ? "select" : kind === "modal" ? "form:order" : kind === "user-select" ? "add-user" : "close"}`,
      commandName: "ticket", commandId: "command", options: { getSubcommand: () => "panel" },
      values: ["order"], message: { author: { id: botId }, components: [] },
      fields: { getTextInputValue: () => "VIP @everyone" },
      isChatInputCommand: () => kind === "command", isStringSelectMenu: () => kind === "select",
      isUserSelectMenu: () => kind === "user-select", isModalSubmit: () => kind === "modal", isButton: () => kind === "button",
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

test('private controls disable unauthorized closing and approve exemptions only for this ticket', async t => {
  const f = fixture();
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state({ autoCloseMinutes: 60 })));
  t.after(await ticketFeature.activate(f.context)); await flush();
  const menu = f.interaction('button', { channelId: room.id, customId: `${prefix}manage` }); await menu.send();
  const row = menu.replies.at(-1).components[0].toJSON().components;
  assert.equal(row[0].disabled, true);
  assert.equal(row[1].disabled, false);
  const request = f.interaction('button', { channelId: room.id, customId: `${prefix}request-exemption` }); await request.send();
  assert.equal(f.records.get(room.id)?.state.exemption?.status, 'PENDING');
  assert.equal(f.records.get(room.id)?.state.autoCloseMinutes, 60);
  await f.interaction('button', { channelId: room.id, customId: `${prefix}approve-exemption`, user: { id: stranger } }).send();
  assert.equal(f.records.get(room.id)?.state.autoCloseMinutes, 60);
  await f.interaction('button', { channelId: room.id, customId: `${prefix}approve-exemption`, user: { id: administrator } }).send();
  assert.equal(f.records.get(room.id)?.state.autoCloseMinutes, 0);
  assert.equal(f.records.get(room.id)?.state.exemption?.status, 'APPROVED');
  assert.equal(ticketDue(f.records.get(room.id)!.state, Date.now(), Date.now()+999999999), false);
  assert.equal((f.context.config.TICKET_CATEGORIES as TicketCategory[])[0]!.autoCloseMinutes, 60);
});

test('normal opens reuse loaded identity/channel/role data and format sequential ticket IDs', async t => {
  const f = fixture([category({ formEnabled: false, fields: [] })]);
  (f.context.config as any).TICKET_BEHAVIOR = { maxOpenPerUser: 2, confirmClose: true, closeRoleIds: [], closeUserIds: [] };
  let lists = 0;
  const original = f.context.tickets.list;
  f.context.tickets.list = async () => { lists++; return original(); };
  t.after(await ticketFeature.activate(f.context)); await flush();
  await f.interaction('select').send(); await f.interaction('select').send();
  assert.equal(lists, 1);
  assert.equal(f.creations[0].name, 'ticket-order-00000');
  assert.equal(f.creations[1].name, 'ticket-order-00001');
  const payload = f.channels.get('888888888888888881').sent[0];
  assert.equal(payload.components.at(-1).toJSON().components[0].label, 'จัดการตั๋ว');
});

test('a pending exemption does not postpone a fixed deadline', async t => {
  t.mock.timers.enable({ apis: ['Date','setInterval'], now: Date.now() });
  const f = fixture();
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state({ openedAt: Date.now(), autoCloseMode: 'OPENED', autoCloseMinutes: 1 })));
  t.after(await ticketFeature.activate(f.context)); await flush();
  await f.interaction('command', { channelId: room.id, options: { getSubcommand: () => 'no-auto-close' } }).send();
  assert.equal(f.records.get(room.id)?.state.exemption?.status, 'PENDING');
  t.mock.timers.tick(60001); await flush();
  assert.equal(f.records.get(room.id)?.state.status, 'CLOSED');
  assert.deepEqual(f.deleted,[room.id]);
});

test('participant state accepts legacy tickets and rejects malformed, duplicate or excessive members', () => {
  assert.deepEqual(readTicketTopic(installation, ticketTopic(installation, state({ participantIds: [stranger] })))?.participantIds, [stranger]);
  for (const participantIds of [null, {}, [123], ['bad-id'], [stranger, stranger], Array(26).fill(stranger)]) {
    assert.equal(readTicketTopic(installation, ticketTopic(installation, { ...state(), participantIds } as any)), null);
  }
});

test('private member picker and forged selections enforce current closing permissions', async t => {
  const f = fixture();
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state()));
  t.after(await ticketFeature.activate(f.context)); await flush();
  for (const user of [owner, stranger, administrator]) {
    const menu = f.interaction('button', { channelId: room.id, user: { id: user }, customId: `${prefix}manage` }); await menu.send();
    const picker = menu.replies.at(-1).components[1].toJSON().components[0];
    assert.equal(picker.type, 5); assert.equal(picker.max_values, 1);
    assert.equal(picker.disabled, user !== administrator);
  }
  for (const user of [owner, stranger]) {
    await f.interaction('user-select', { channelId: room.id, user: { id: user }, values: [staff] }).send();
  }
  assert.equal(f.overwrites.length, 0);
  assert.equal(f.records.get(room.id)?.state.participantIds, undefined);
  // A matching custom ID on someone else's message is ignored entirely.
  const spoof = f.interaction('user-select', { channelId: room.id, user: { id: administrator }, values: [staff], message: { author: { id: stranger } } }); await spoof.send();
  assert.equal(spoof.replies.length, 0);
});

test('adding a member persists access across restarts without granting closing privileges', async t => {
  const f = fixture(undefined, true);
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state()));
  const dispose = await ticketFeature.activate(f.context); await flush();
  await f.interaction('user-select', { channelId: room.id, user: { id: administrator }, values: [stranger] }).send();
  assert.deepEqual(f.records.get(room.id)?.state.participantIds, [stranger]);
  const overwrite = f.overwrites[0];
  assert.equal(overwrite.id, stranger);
  assert.equal(overwrite.options.type, OverwriteType.Member);
  assert.deepEqual(overwrite.patch, { ViewChannel: true, ReadMessageHistory: true, SendMessages: true, AttachFiles: true, EmbedLinks: true, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false });
  assert.deepEqual(room.sent.at(-1).allowedMentions, { parse: [] });
  await dispose();
  t.after(await ticketFeature.activate({ ...f.context, runtimeState: f.saves.at(-1) })); await flush();
  const history = f.interaction('button', { channelId: room.id, user: { id: stranger }, customId: `${prefix}history` }); await history.send();
  assert.equal(history.replies.at(-1).files.length, 1);
  const close = f.interaction('button', { channelId: room.id, user: { id: stranger }, customId: `${prefix}confirm-close` }); await close.send();
  assert.equal(f.deleted.length, 0);
  const menu = f.interaction('button', { channelId: room.id, user: { id: stranger }, customId: `${prefix}manage` }); await menu.send();
  assert.equal(menu.replies.at(-1).components[0].toJSON().components[0].disabled, true);
  await f.interaction('button', { channelId: room.id, user: { id: administrator }, customId: `${prefix}confirm-close` }).send();
  assert.deepEqual(f.overwrites.slice(1).map(entry => entry.id).sort(), [owner, stranger].sort());
  assert.equal(f.overwrites.slice(1).every(entry => entry.patch.SendMessages === false && entry.patch.SendMessagesInThreads === false), true);
  assert.deepEqual(f.deleted, [room.id]);
});

test('failed participant persistence never grants access and failed permissions roll state back for retry', async t => {
  const f = fixture();
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state()));
  t.after(await ticketFeature.activate(f.context)); await flush();
  const invite = () => f.interaction('user-select', { channelId: room.id, user: { id: administrator }, values: [stranger] }).send();
  f.failRegistry(true); await invite();
  assert.equal(f.overwrites.length, 0);
  f.failRegistry(false); f.failPermissions(true); await invite();
  assert.equal(f.records.get(room.id)?.state.participantIds, undefined);
  f.failPermissions(false); await invite(); await invite();
  assert.deepEqual(f.records.get(room.id)?.state.participantIds, [stranger]);
});

test('configured closing roles can invite by slash command while bots and nonmembers are rejected', async t => {
  const f = fixture();
  (f.context.config as any).TICKET_BEHAVIOR = { maxOpenPerUser: 1, confirmClose: true, closeRoleIds: [staff], closeUserIds: [] };
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state()));
  t.after(await ticketFeature.activate(f.context)); await flush();
  const command = f.commands.get('command').options.find((option: any) => option.name === 'add-user');
  assert.equal(command.options[0].name, 'member'); assert.equal(command.options[0].required, true);
  await f.interaction('command', { channelId: room.id, user: { id: staff }, options: { getSubcommand: () => 'add-user', getUser: () => ({ id: stranger }) } }).send();
  assert.deepEqual(f.records.get(room.id)?.state.participantIds, [stranger]);
  await f.interaction('user-select', { channelId: room.id, user: { id: administrator }, values: [botId] }).send();
  const server = await f.client.guilds.fetch();
  const fetch = server.members.fetch;
  server.members.fetch = async (options: any) => { if (options.user === owner) throw Error('Unknown Member'); return fetch(options); };
  await f.interaction('user-select', { channelId: room.id, user: { id: administrator }, values: [owner] }).send();
  assert.equal(f.overwrites.length, 1);
  assert.deepEqual(f.records.get(room.id)?.state.participantIds, [stranger]);
});

test('participant limit disables the picker and rejects stale selections without altering access', async t => {
  const f = fixture();
  const participants = Array.from({ length: 25 }, (_, index) => String(100000000000000000n + BigInt(index)));
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state({ participantIds: participants })));
  t.after(await ticketFeature.activate(f.context)); await flush();
  const menu = f.interaction('button', { channelId: room.id, user: { id: administrator }, customId: `${prefix}manage` }); await menu.send();
  assert.equal(menu.replies.at(-1).components[1].toJSON().components[0].disabled, true);
  await f.interaction('user-select', { channelId: room.id, user: { id: administrator }, values: [stranger] }).send();
  assert.equal(f.overwrites.length, 0);
  assert.deepEqual(f.records.get(room.id)?.state.participantIds, participants);
});

test('explicit closing users can invite but stale invitations stop once closing begins', async t => {
  const f = fixture();
  (f.context.config as any).TICKET_BEHAVIOR = { maxOpenPerUser: 1, confirmClose: true, closeRoleIds: [], closeUserIds: [staff] };
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state()));
  const dispose = await ticketFeature.activate(f.context); await flush();
  await f.interaction('user-select', { channelId: room.id, user: { id: staff }, values: [stranger] }).send();
  assert.deepEqual(f.records.get(room.id)?.state.participantIds, [stranger]);
  await dispose();
  f.records.get(room.id)!.state.status = 'CLOSING';
  f.failArchive();
  t.after(await ticketFeature.activate({ ...f.context, runtimeState: f.saves.at(-1) })); await flush();
  const before = f.overwrites.length;
  await f.interaction('user-select', { channelId: room.id, user: { id: staff }, values: [staff] }).send();
  assert.equal(f.overwrites.length, before);
  assert.deepEqual(f.records.get(room.id)?.state.participantIds, [stranger]);
  assert.equal(f.records.get(room.id)?.state.status, 'CLOSING');
});

test('authorized no-auto-close commands disable the timer immediately and survive a restart', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: Date.now() });
  const f = fixture();
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state({ openedAt: Date.now(), autoCloseMode: 'OPENED', autoCloseMinutes: 1 })));
  const other = f.makeChannel('999999999999999998', ticketTopic(installation, state({ openedAt: Date.now(), autoCloseMode: 'OPENED', autoCloseMinutes: 1 })));
  const dispose = await ticketFeature.activate(f.context); await flush();
  const command = f.interaction('command', { channelId: room.id, user: { id: administrator }, options: { getSubcommand: () => 'no-auto-close' } }); await command.send();
  assert.equal(f.records.get(room.id)?.state.autoCloseMinutes, 0);
  assert.equal(f.records.get(room.id)?.state.exemption?.status, 'APPROVED');
  assert.equal(f.records.get(room.id)?.state.exemption?.decidedBy, administrator);
  assert.match(command.replies.at(-1).content, /ยกเลิกปิดอัตโนมัติ/);
  assert.equal(room.sent.some((payload: any) => payload.components), false);
  assert.equal((f.context.config.TICKET_CATEGORIES as TicketCategory[])[0]!.autoCloseMinutes, 60);
  await dispose();
  t.after(await ticketFeature.activate({ ...f.context, runtimeState: f.saves.at(-1) })); await flush();
  t.mock.timers.tick(60001); await flush();
  assert.equal(f.records.get(room.id)?.state.status, 'OPEN');
  assert.equal(f.records.get(other.id)?.state.status, 'CLOSED');
  assert.deepEqual(f.deleted, [other.id]);
});

test('configured closing roles and users can cancel a pending timer directly from private controls', async t => {
  for (const behavior of [{ closeRoleIds: [staff], closeUserIds: [] }, { closeRoleIds: [], closeUserIds: [staff] }]) {
    const f = fixture();
    (f.context.config as any).TICKET_BEHAVIOR = { maxOpenPerUser: 1, confirmClose: true, ...behavior };
    const requestedAt = Date.now() - 1000;
    const room = f.makeChannel('999999999999999999', ticketTopic(installation, state({ exemption: { requestedBy: owner, requestedAt, status: 'PENDING' } })));
    t.after(await ticketFeature.activate(f.context)); await flush();
    const menu = f.interaction('button', { channelId: room.id, user: { id: staff }, customId: `${prefix}manage` }); await menu.send();
    const control = menu.replies.at(-1).components[0].toJSON().components[1];
    assert.equal(control.disabled, false); assert.equal(control.label, 'ยกเลิกปิดอัตโนมัติ');
    await f.interaction('button', { channelId: room.id, user: { id: staff }, customId: `${prefix}request-exemption` }).send();
    const saved = f.records.get(room.id)!.state;
    assert.equal(saved.autoCloseMinutes, 0);
    assert.equal(saved.exemption?.requestedBy, owner);
    assert.equal(saved.exemption?.requestedAt, requestedAt);
    assert.equal(saved.exemption?.status, 'APPROVED');
    assert.equal(saved.exemption?.decidedBy, staff);
  }
});

test('ordinary opener still requests approval and strangers cannot cancel timers', async t => {
  const f = fixture();
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state()));
  t.after(await ticketFeature.activate(f.context)); await flush();
  await f.interaction('command', { channelId: room.id, user: { id: stranger }, options: { getSubcommand: () => 'no-auto-close' } }).send();
  assert.equal(f.records.get(room.id)?.state.exemption, undefined);
  await f.interaction('command', { channelId: room.id, options: { getSubcommand: () => 'no-auto-close' } }).send();
  assert.equal(f.records.get(room.id)?.state.exemption?.status, 'PENDING');
  assert.equal(f.records.get(room.id)?.state.autoCloseMinutes, 60);
});

test('failed direct cancellation keeps the original deadline and posts no success', async t => {
  const f = fixture();
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state()));
  t.after(await ticketFeature.activate(f.context)); await flush();
  f.failRegistry(true);
  await f.interaction('command', { channelId: room.id, user: { id: administrator }, options: { getSubcommand: () => 'no-auto-close' } }).send();
  assert.equal(f.records.get(room.id)?.state.autoCloseMinutes, 60);
  assert.equal(room.sent.length, 0);
});

function topicPanelMessage(payload: any) {
  let components = payload.components.map((component: any) => component.toJSON ? component.toJSON() : structuredClone(component));
  const edits: any[] = [];
  const message: any = {
    author: { id: botId }, edits,
    get components() { return components.map((component: any) => ({ toJSON: () => structuredClone(component) })); },
    edit: async (update: any) => { edits.push(update); components = structuredClone(update.components); return message; },
  };
  return message;
}

test('topic menus reset after showing a form even if it is cancelled, and accept the same topic again', async t => {
  const f = fixture(); t.after(await ticketFeature.activate(f.context)); await flush();
  await f.interaction('command', { user: { id: staff } }).send();
  const payload = f.panel.sent[0];
  const original = payload.components.map((component: any) => component.toJSON ? component.toJSON() : component);
  const message = topicPanelMessage(payload);
  const first = f.interaction('select', { message });
  const edit = message.edit;
  message.edit = async (update: any) => { assert.ok(first.value.modal); return edit(update); };
  await first.send();
  assert.equal(f.creations.length, 0);
  assert.equal(message.edits.length, 1);
  const updated = message.edits[0].components;
  const menu = updated.at(-1).components[0];
  assert.equal(menu.placeholder, 'เลือกหัวข้อเพื่อเปิดตั๋ว');
  assert.notEqual(menu.custom_id, `${prefix}select`);
  assert.equal(menu.options.every((option: any) => option.default === false), true);
  assert.deepEqual(updated.slice(0, -1), original.slice(0, -1));
  assert.deepEqual(Object.keys(message.edits[0]).sort(), ['allowedMentions', 'components']);
  // Cancel the first form without submitting, then choose the same topic on the refreshed menu.
  const second = f.interaction('select', { message, customId: menu.custom_id }); await second.send();
  assert.ok(second.value.modal);
  assert.equal(message.edits.length, 2);
  assert.notEqual(message.edits[1].components.at(-1).components[0].custom_id, menu.custom_id);
});

test('direct topic opens reset before channel creation and also reset when the opening limit rejects a retry', async t => {
  const f = fixture([category({ formEnabled: false, fields: [] })]);
  t.after(await ticketFeature.activate(f.context)); await flush();
  await f.interaction('command', { user: { id: staff } }).send();
  const message = topicPanelMessage(f.panel.sent[0]);
  const select = f.interaction('select', { message });
  const edit = message.edit;
  message.edit = async (update: any) => { assert.equal(select.value.deferred, true); return edit(update); };
  await select.send();
  assert.equal(f.creations.length, 1);
  assert.equal(message.edits.length, 1);
  const again = f.interaction('select', { message, customId: message.edits[0].components.at(-1).components[0].custom_id }); await again.send();
  assert.equal(f.creations.length, 1);
  assert.match(again.replies.at(-1).content, /สูงสุด 1/);
  assert.equal(message.edits.length, 2);
});

test('nested panel menus preserve other controls and refresh stale topics without creating tickets', async t => {
  const f = fixture(); t.after(await ticketFeature.activate(f.context)); await flush();
  const unrelated = { type: 1, components: [{ type: 2, custom_id: 'another-button', label: 'Keep me', style: 2 }] };
  const message = topicPanelMessage({ components: [{ type: 17, accent_color: 123, components: [
    { type: 10, content: 'Welcome' }, unrelated,
    { type: 1, components: [{ type: 3, custom_id: `${prefix}select`, placeholder: 'Old', options: [{ label: 'Deleted', value: 'deleted', default: true }] }] },
  ] }] });
  await f.interaction('select', { message, values: ['deleted'] }).send();
  assert.equal(f.creations.length, 0);
  const components = message.edits[0].components[0].components;
  assert.deepEqual(components[0], { type: 10, content: 'Welcome' });
  assert.deepEqual(components[1], unrelated);
  assert.equal(components[2].components[0].options[0].default, false);
});

test('reset failures never block creating a ticket and untrusted or unrelated menus are not edited', async t => {
  const f = fixture([category({ formEnabled: false, fields: [] })]);
  t.after(await ticketFeature.activate(f.context)); await flush();
  await f.interaction('command', { user: { id: staff } }).send();
  const message = topicPanelMessage(f.panel.sent[0]);
  message.edit = async () => { throw Error('Message edit unavailable'); };
  await f.interaction('select', { message }).send();
  assert.equal(f.creations.length, 1);
  assert.equal(f.errors.some(error => error[0] === 'TICKET_PANEL_RESET_FAILED'), true);
  const untrusted = topicPanelMessage(f.panel.sent[0]); untrusted.author.id = stranger;
  await f.interaction('select', { message: untrusted }).send();
  const unrelated = topicPanelMessage(f.panel.sent[0]);
  await f.interaction('select', { message: unrelated, customId: `${prefix}unrelated` }).send();
  assert.equal(untrusted.edits.length, 0); assert.equal(unrelated.edits.length, 0);
});

function configureActions(f: ReturnType<typeof fixture>, actions: Record<string, unknown>, controlStyle = 'DIRECT') {
  (f.context.config as any).TICKET_BEHAVIOR = { maxOpenPerUser: 1, confirmClose: true, closeRoleIds: [], closeUserIds: [], controlStyle, actions };
}

test('legacy configurations keep management controls and reject malformed action settings', () => {
  const config = { TICKET_CATEGORIES: [category()] };
  assert.equal(readTicketConfig(config).actions.close, 'BOTH');
  assert.equal(readTicketConfig(config).actions.schedule, 'OFF');
  for (const actions of [null, [], 'BOTH', { close: null }, { close: ['BOTH'] }, { close: 'UNKNOWN' }, { unknown: 'OFF' }]) {
    assert.throws(() => readTicketConfig({ ...config, TICKET_BEHAVIOR: { maxOpenPerUser: 1, confirmClose: true, closeRoleIds: [], closeUserIds: [], actions } }));
  }
});

test('direct close-only welcome preserves forms and registers independent commands for other actions', async t => {
  const f = fixture([category({ formEnabled: false, fields: [] })]);
  configureActions(f, { close: 'BUTTON', schedule: 'COMMAND', autoClose: 'COMMAND', addUser: 'COMMAND', history: 'OFF' });
  t.after(await ticketFeature.activate(f.context)); await flush();
  await f.interaction('select').send();
  const controls = f.channels.get('888888888888888881').sent[0].components.at(-1).toJSON().components;
  assert.deepEqual(controls.map((control: any) => [control.custom_id, control.label]), [[`${prefix}close`, 'ปิดตั๋ว']]);
  assert.deepEqual(f.commands.get('command').options.map((option: any) => option.name), ['panel', 'add-user', 'auto-close', 'no-auto-close', 'approve-exemption', 'deny-exemption']);
});

test('command-only rooms omit buttons, allow close confirmation and deny stale buttons', async t => {
  const f = fixture([category({ formEnabled: false, fields: [] })]);
  configureActions(f, { close: 'COMMAND', schedule: 'COMMAND', autoClose: 'COMMAND', addUser: 'COMMAND', history: 'COMMAND' });
  t.after(await ticketFeature.activate(f.context)); await flush();
  await f.interaction('select').send();
  const room = f.channels.get('888888888888888881');
  assert.equal(JSON.stringify(room.sent).includes('"custom_id"'), false);
  const stale = f.interaction('button', { channelId: room.id, user: { id: administrator } }); await stale.send();
  assert.match(stale.replies.at(-1).embeds[0].description, /ถูกปิดไว้/);
  const command = f.interaction('command', { channelId: room.id, user: { id: administrator }, options: { getSubcommand: () => 'close' } }); await command.send();
  assert.equal(command.replies.at(-1).components[0].toJSON().components[0].custom_id, `${prefix}confirm-close`);
  await f.interaction('button', { channelId: room.id, user: { id: administrator }, customId: `${prefix}confirm-close` }).send();
  assert.deepEqual(f.deleted, [room.id]);
});

test('buttons-only actions omit slash commands and block stale commands or disabled actions', async t => {
  const f = fixture();
  configureActions(f, { close: 'OFF', schedule: 'BUTTON', autoClose: 'BUTTON', addUser: 'BUTTON', history: 'OFF' });
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state()));
  t.after(await ticketFeature.activate(f.context)); await flush();
  assert.deepEqual(f.commands.get('command').options.map((option: any) => option.name), ['panel']);
  await f.interaction('command', { channelId: room.id, user: { id: administrator }, options: { getSubcommand: () => 'no-auto-close' } }).send();
  await f.interaction('command', { channelId: room.id, user: { id: administrator }, options: { getSubcommand: () => 'add-user', getUser: () => ({ id: stranger }) } }).send();
  await f.interaction('button', { channelId: room.id, user: { id: administrator }, customId: `${prefix}confirm-close` }).send();
  assert.equal(f.records.get(room.id)?.state.autoCloseMinutes, 60);
  assert.equal(f.records.get(room.id)?.state.participantIds, undefined);
  assert.equal(f.deleted.length, 0);
  const picker = f.interaction('button', { channelId: room.id, user: { id: administrator }, customId: `${prefix}participants` }); await picker.send();
  assert.equal(picker.replies.at(-1).components[0].toJSON().components[0].type, 5);
});

test('command-only exemption requests can be approved or denied without management buttons', async t => {
  const f = fixture(); configureActions(f, { autoClose: 'COMMAND' });
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state()));
  t.after(await ticketFeature.activate(f.context)); await flush();
  const command = (name: string, user = owner) => f.interaction('command', { channelId: room.id, user: { id: user }, options: { getSubcommand: () => name } }).send();
  await command('no-auto-close');
  assert.deepEqual(room.sent.at(-1).components, []);
  assert.match(room.sent.at(-1).content, /approve-exemption/);
  await command('approve-exemption', stranger);
  assert.equal(f.records.get(room.id)?.state.exemption?.status, 'PENDING');
  await command('deny-exemption', administrator);
  assert.equal(f.records.get(room.id)?.state.autoCloseMinutes, 60);
  await command('no-auto-close'); await command('approve-exemption', administrator);
  assert.equal(f.records.get(room.id)?.state.autoCloseMinutes, 0);
});

test('setting a timer starts now instead of at old opening time and survives restart', async t => {
  t.mock.timers.enable({ apis: ['Date','setInterval'], now: Date.now() });
  const f = fixture(); configureActions(f, { schedule: 'BOTH' });
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state({ autoCloseMinutes: 0, exemption: { requestedBy: owner, requestedAt: Date.now()-1000, status: 'PENDING' } })));
  const dispose = await ticketFeature.activate(f.context); await flush();
  await f.interaction('command', { channelId: room.id, user: { id: administrator }, options: { getSubcommand: () => 'auto-close', getInteger: () => 1, getString: () => 'FROM_NOW' } }).send();
  const saved = f.records.get(room.id)!.state;
  assert.equal(saved.autoCloseStartAt, Date.now()); assert.equal(saved.exemption, undefined);
  assert.equal(ticketDue(saved, saved.openedAt, Date.now()+59999), false);
  assert.equal(ticketDue(saved, saved.openedAt, Date.now()+60000), true);
  await dispose();
  t.after(await ticketFeature.activate({ ...f.context, runtimeState: f.saves.at(-1) })); await flush();
  assert.equal(f.deleted.length, 0);
  t.mock.timers.tick(60001); await flush();
  assert.deepEqual(f.deleted, [room.id]);
});

test('timer button opens a modal and validates authority and minutes again at submission', async t => {
  const f = fixture(); configureActions(f, { schedule: 'BOTH' });
  const room = f.makeChannel('999999999999999999', ticketTopic(installation, state({ autoCloseMinutes: 0 })));
  t.after(await ticketFeature.activate(f.context)); await flush();
  const button = f.interaction('button', { channelId: room.id, user: { id: administrator }, customId: `${prefix}set-timer` }); await button.send();
  assert.equal(button.value.modal.custom_id, `${prefix}timer`);
  assert.equal(button.value.modal.components[1].component.type, 3);
  const submit = (user: string, minutes: string) => f.interaction('modal', { channelId: room.id, user: { id: user }, customId: `${prefix}timer`, fields: { getTextInputValue: () => minutes, getStringSelectValues: () => ['IDLE'] } }).send();
  await submit(owner, '30'); await submit(administrator, '0'); await submit(administrator, '1.5'); await submit(administrator, '43201');
  assert.equal(f.records.get(room.id)?.state.autoCloseMinutes, 0);
  await submit(administrator, '30');
  const saved = f.records.get(room.id)!.state;
  assert.equal(saved.autoCloseMinutes, 30); assert.equal(saved.autoCloseMode, 'IDLE');
  assert.equal(ticketDue(saved, saved.openedAt, saved.autoCloseStartAt!+1800000), true);
  assert.equal(ticketDue(saved, saved.autoCloseStartAt!+1000, saved.autoCloseStartAt!+1800000), false);
});
