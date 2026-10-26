import { assertFeatureError } from "./assert-feature-error.js";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { Collection, EmbedBuilder, MessageFlags, type Guild, type GuildMember, type Client } from "discord.js";
import { createMemberSpendingFeature, memberSpendingFeature, spendingMonth, syncMonthlyRoles } from "../src/features/member-spending/v1.0.0.js";
import { shopStatusFeature } from "../src/features/shop-status/v1.0.0.js";
import { BotManager } from "../src/bot-manager.js";
import type { RuntimeApi } from "../src/api-client.js";
import type { FeatureContext, MemberSpendingStore, RuntimeBot } from "../src/types.js";

const memberId = "222222222222222222";
const userAvatar = `https://cdn.discordapp.com/avatars/${memberId}/profile.png`;
const guildAvatar = `https://cdn.discordapp.com/guilds/111111111111111111/users/${memberId}/avatars/server.png`;
const defaultAvatar = "https://cdn.discordapp.com/embed/avatars/4.png";

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

for (const subcommand of ["add", "check", "list"] as const) {
  test(`external database startup cannot block spending ${subcommand} acknowledgement`, async () => {
    const client = new EventEmitter();
    const state = spendingInteraction(subcommand);
    let connections = 0;
    let reads = 0;
    let closed = 0;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const entry = { memberDiscordId: memberId, amountSatang: 10000, txCount: 1 };
    const read = async () => { reads++; return entry; };
    const feature = createMemberSpendingFeature(async () => {
      connections++;
      await pending;
      return {
        add: read, get: read, set: read,
        totals: async () => ({ amountSatang: 0, txCount: 0 }),
        remove: async () => true,
        leaderboard: async () => { reads++; return []; },
        close: async () => { closed++; },
      };
    });
    const context = {
      client, botId: "bot", config: { SPENDING_DB_USE_OWN: true },
      secrets: { SPENDING_DB_URL: "postgresql://shop@example.invalid/shop" },
      presentations: {}, permissions: { canUse: () => true },
    } as unknown as FeatureContext;
    const interaction = {
      ...state.interaction,
      options: {
        ...state.interaction.options,
        getUser: () => subcommand === "add" ? { id: memberId, username: "Customer", displayAvatarURL: () => defaultAvatar } : null,
        getInteger: () => 100,
      },
      guild: { members: { fetch: async () => null } },
    };
    // Keep the original object's acknowledgement state in sync with the emitted interaction.
    interaction.deferReply = async payload => { state.acknowledgements.push(payload); interaction.deferred = true; };
    let activated = false;
    const activation = feature.activate(context).then(dispose => { activated = true; return dispose; });
    try {
      await settle();
      assert.equal(activated, true, "the command listener must start before connecting to the external database");
      assert.equal(connections, 0);
      client.emit("interactionCreate", interaction);
      await settle();
      assert.deepEqual(state.acknowledgements, [subcommand === "list" ? {} : { flags: MessageFlags.Ephemeral }]);
      assert.equal(connections, 1);
      assert.equal(reads, 0);
      release();
      await settle();
      assert.equal(reads, 1);
      assert.equal(state.edits.length, 1);
    } finally {
      release();
      const dispose = await activation;
      await settle();
      await dispose();
    }
    assert.equal(closed, 1);
  });
}

test("external database connection failures keep spending available for the next attempt", async () => {
  const client = new EventEmitter();
  let attempts = 0;
  let closed = 0;
  const feature = createMemberSpendingFeature(async () => {
    if (++attempts === 1) throw new Error("Database temporarily unavailable");
    return {
      add: async () => { throw new Error("unused"); }, set: async () => { throw new Error("unused"); },
      get: async () => null, remove: async () => false, leaderboard: async () => [],
      totals: async () => ({ amountSatang: 0, txCount: 0 }),
      close: async () => { closed++; },
    };
  });
  const dispose = await feature.activate({
    client, botId: "bot", config: { SPENDING_DB_USE_OWN: true },
    secrets: { SPENDING_DB_URL: "postgresql://shop@example.invalid/shop" },
    presentations: {}, permissions: { canUse: () => true },
  } as unknown as FeatureContext);
  try {
    const first = spendingInteraction("check");
    client.emit("interactionCreate", first.interaction);
    await settle();
    assert.equal(first.acknowledgements.length, 1);
    assert.equal(first.edits.length, 1);
    assert.equal(assertFeatureError(first.edits[0], "Member Spending Card").description, "Database temporarily unavailable");
    const second = spendingInteraction("check");
    client.emit("interactionCreate", second.interaction);
    await settle();
    assert.equal(attempts, 2);
    assert.equal(second.acknowledgements.length, 1);
    assert.equal(second.edits.length, 1);
    assert.equal(client.listenerCount("interactionCreate"), 1);
  } finally { await dispose(); }
  assert.equal(closed, 1);
});

test("concurrent spending commands share external initialization and shutdown closes the pending store", async () => {
  const client = new EventEmitter();
  let connections = 0, reads = 0, closed = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const feature = createMemberSpendingFeature(async () => {
    connections++;
    await pending;
    return {
      add: async () => { throw new Error("unused"); }, set: async () => { throw new Error("unused"); },
      get: async () => { reads++; return null; }, remove: async () => false, leaderboard: async () => [],
      totals: async () => ({ amountSatang: 0, txCount: 0 }), close: async () => { closed++; },
    };
  });
  const dispose = await feature.activate({
    client, botId: "bot", config: { SPENDING_DB_USE_OWN: true },
    secrets: { SPENDING_DB_URL: "postgresql://shop@example.invalid/shop" },
    presentations: {}, permissions: { canUse: () => true },
  } as unknown as FeatureContext);
  const interactions = [spendingInteraction("check"), spendingInteraction("check")];
  try {
    for (const state of interactions) client.emit("interactionCreate", state.interaction);
    await settle();
    assert.equal(connections, 1);
    assert.equal(interactions.every(state => state.acknowledgements.length === 1), true);
  } finally {
    const shutdown = dispose();
    release();
    await shutdown;
    await settle();
  }
  assert.equal(reads, 0);
  assert.equal(closed, 1);
  assert.equal(client.listenerCount("interactionCreate"), 0);
});

test("installing Shop Status restarts the bot without losing spending commands when its external database is unavailable", async () => {
  let attempts = 0;
  const entry = { memberDiscordId: memberId, amountSatang: 10000, txCount: 1 };
  const spending = createMemberSpendingFeature(async () => {
    if (++attempts === 1) throw new Error("Database temporarily unavailable");
    return {
      add: async () => entry, set: async () => entry, get: async () => entry,
      remove: async () => true, leaderboard: async () => [],
      totals: async () => ({ amountSatang: 10000, txCount: 1 }), close: async () => undefined,
    };
  });
  class FakeClient extends EventEmitter {
    ready = false;
    application = { commands: {
      fetch: async () => new Collection(),
      create: async (command: { name: string }) => ({ ...command, id: "shop-command" }),
    } };
    guilds = { fetch: async () => ({ commands: { create: async () => undefined } }) };
    isReady() { return this.ready; }
    async login() { this.ready = true; this.emit("clientReady"); return "token"; }
    destroy() { this.removeAllListeners(); }
  }
  const clients: FakeClient[] = [];
  const statuses: Array<{ installationId?: string; status: string }> = [];
  const manager = new BotManager({
    reportStatus: async (status: { status: string }) => { statuses.push(status); },
    saveFeatureState: async () => undefined,
  } as unknown as RuntimeApi, () => {
    const client = new FakeClient(); clients.push(client); return client as unknown as Client;
  }, key => key === "shop-status" ? shopStatusFeature : spending);
  const bot: RuntimeBot = {
    id: "bot", name: "Shop bot", discordApplicationId: null, discordGuildId: "guild", discordToken: "token", restartRevision: 0,
    runtimeSubscription: { id: "runtime", currentPeriodEnd: "2099-01-01T00:00:00Z", autoRenew: false },
    features: [{
      installationId: "spending-install", code: "member-spending", version: "1.0.0", runtimeKey: "member-spending", configRevision: 1,
      config: { SPENDING_DB_USE_OWN: true }, secrets: { SPENDING_DB_URL: "postgresql://shop@example.invalid/shop" }, presentations: {}, runtimeState: {},
    }],
  };
  try {
    await manager.reconcile([bot]);
    await manager.reconcile([{ ...bot, features: [...bot.features, {
      installationId: "shop-install", code: "shop-status", version: "1.0.0", runtimeKey: "shop-status", configRevision: 1,
      config: {}, secrets: {}, presentations: {}, runtimeState: {},
    }] }]);
    await settle();
    assert.equal(clients.length, 2);
    assert.equal(attempts, 0);
    const client = clients[1]!;
    for (const subcommand of ["add", "list", "check"] as const) {
      const state = spendingInteraction(subcommand);
      const interaction = {
        ...state.interaction,
        options: { ...state.interaction.options, getUser: () => ({ id: memberId }), getInteger: () => 100 },
      };
      interaction.deferReply = async payload => { state.acknowledgements.push(payload); interaction.deferred = true; };
      client.emit("interactionCreate", interaction);
      await settle();
      assert.equal(state.acknowledgements.length, 1, `${subcommand} must acknowledge after restart`);
      assert.equal(state.edits.length, 1, `${subcommand} must finish or explain the storage failure`);
      if (subcommand === "add") assert.equal(assertFeatureError(state.edits[0], "Member Spending Card").description, "Database temporarily unavailable");
    }
    assert.equal(attempts, 2);
    assert.equal(statuses.some(status => status.installationId === "spending-install" && status.status === "ERROR"), false);
  } finally { await manager.shutdown(); }
});

function spendingInteraction(subcommand: string, modal = false) {
  const acknowledgements: unknown[] = [];
  const replies: unknown[] = [];
  const edits: unknown[] = [];
  const interaction = {
    commandName: "spending",
    commandId: "spending-command",
    guildId: "guild",
    customId: `spending:update:${memberId}`,
    user: { id: memberId },
    memberPermissions: { has: () => true },
    options: { getSubcommand: () => subcommand, getUser: () => null },
    fields: { getTextInputValue: (key: string) => key === "amount" ? "100" : "" },
    guild: {},
    deferred: false,
    replied: false,
    isChatInputCommand: () => !modal,
    isModalSubmit: () => modal,
    isRepliable: () => true,
    inGuild: () => true,
    deferReply: async (payload: unknown) => {
      acknowledgements.push(payload);
      interaction.deferred = true;
    },
    reply: async (payload: unknown) => { replies.push(payload); interaction.replied = true; },
    editReply: async (payload: unknown) => { edits.push(payload); },
  };
  return { interaction, acknowledgements, replies, edits };
}

for (const [subcommand, method, result] of [
  ["check", "get", { memberDiscordId: memberId, amountSatang: 12300, txCount: 2 }],
  ["total", "totals", { amountSatang: 12300, txCount: 2 }],
  ["delete", "remove", true],
  ["list", "leaderboard", []],
  ["rank", "leaderboard", []],
  ["update", "set", { memberDiscordId: memberId, amountSatang: 10000, txCount: 2 }],
] as const) {
  test(`spending ${subcommand} acknowledges before waiting for storage`, async () => {
    const client = new EventEmitter();
    const state = spendingInteraction(subcommand, subcommand === "update");
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let requested = false;
    const context = {
      client, config: {}, secrets: {}, presentations: {},
      permissions: { canUse: () => true },
      memberSpending: { [method]: async () => { requested = true; await pending; return result; } },
    } as unknown as FeatureContext;
    const dispose = await memberSpendingFeature.activate(context);
    try {
      client.emit("interactionCreate", state.interaction);
      await settle();
      assert.equal(requested, true);
      assert.deepEqual(state.acknowledgements, [subcommand === "list" || subcommand === "rank" ? {} : { flags: MessageFlags.Ephemeral }]);
      assert.equal(state.edits.length, 0);
      release();
      await settle();
      assert.equal(state.edits.length, 1);
      assert.equal(state.replies.length, 0);
    } finally { release(); await settle(); await dispose(); }
  });
}

test("spending reports a failed database read through the deferred reply", async () => {
  const client = new EventEmitter();
  const state = spendingInteraction("check");
  const context = {
    client, config: {}, secrets: {}, presentations: {},
    permissions: { canUse: () => true },
    memberSpending: { get: async () => { throw new Error("Database unavailable"); } },
  } as unknown as FeatureContext;
  const dispose = await memberSpendingFeature.activate(context);
  try {
    client.emit("interactionCreate", state.interaction);
    await settle();
    assert.equal(state.acknowledgements.length, 1);
    assert.equal(state.edits.length, 1);
    assert.equal(assertFeatureError(state.edits[0], "Member Spending Card").description, "Database unavailable");
    assert.equal(state.replies.length, 0);
  } finally { await dispose(); }
});

for (const modal of [false, true]) {
  test(`spending does not write when acknowledgement fails (modal: ${modal})`, async () => {
    const client = new EventEmitter();
    const state = spendingInteraction(modal ? "update" : "delete", modal);
    let writes = 0;
    state.interaction.deferReply = async () => { throw new Error("Unknown interaction"); };
    const context = {
      client, config: {}, secrets: {}, presentations: {},
      permissions: { canUse: () => true },
      memberSpending: {
        remove: async () => { writes++; return true; },
        set: async () => { writes++; return {}; },
      },
    } as unknown as FeatureContext;
    const dispose = await memberSpendingFeature.activate(context);
    try {
      client.emit("interactionCreate", state.interaction);
      await settle();
      assert.equal(writes, 0);
    } finally { await dispose(); }
  });
}

test("spending denies unauthorized commands before accessing storage", async () => {
  const client = new EventEmitter();
  const state = spendingInteraction("check");
  let reads = 0;
  const context = {
    client, config: {}, secrets: {}, presentations: {},
    permissions: { canUse: () => false },
    memberSpending: { get: async () => { reads++; return null; } },
  } as unknown as FeatureContext;
  const dispose = await memberSpendingFeature.activate(context);
  try {
    client.emit("interactionCreate", state.interaction);
    await settle();
    assert.equal(reads, 0);
    assert.equal(state.acknowledgements.length, 0);
    assert.equal(state.replies.length, 1);
    assert.equal(assertFeatureError(state.replies[0], "Member Spending Card", "COMMAND_PERMISSION_DENIED").description, "คุณไม่มีสิทธิ์ใช้คำสั่งนี้");
    assert.equal((state.replies[0] as { flags: number }).flags, MessageFlags.Ephemeral);
  } finally { await dispose(); }
});

test("spending update opens the modal without deferring the command", async () => {
  const client = new EventEmitter();
  const state = spendingInteraction("update");
  let shown = 0;
  const interaction = {
    ...state.interaction,
    options: { ...state.interaction.options, getUser: () => ({ id: memberId }) },
    showModal: async () => { shown++; },
  };
  const context = {
    client, config: {}, secrets: {}, presentations: {},
    permissions: { canUse: () => true },
  } as unknown as FeatureContext;
  const dispose = await memberSpendingFeature.activate(context);
  try {
    client.emit("interactionCreate", interaction);
    await settle();
    assert.equal(shown, 1);
    assert.equal(state.acknowledgements.length, 0);
    assert.equal(state.replies.length, 0);
  } finally { await dispose(); }
});

for (const shopFirst of [true, false]) {
  test(`Shop Status and spending register and handle separate commands (shop first: ${shopFirst})`, async () => {
    const client = Object.assign(new EventEmitter(), {
      isReady: () => false,
      application: { commands: {
        fetch: async () => new Collection(),
        create: async (command: { name: string }) => { globalCommands.push(command.name); return { ...command, id: "shop-command" }; },
      } },
      guilds: { fetch: async () => ({ commands: {
        create: async (command: { name: string }) => { guildCommands.push(command.name); },
      } }) },
    });
    const globalCommands: string[] = [];
    const guildCommands: string[] = [];
    const errors: unknown[] = [];
    const state = spendingInteraction("check");
    let reads = 0;
    const context = {
      client, guildId: "guild", config: {}, secrets: {}, presentations: {}, runtimeState: {},
      permissions: { canUse: () => true },
      saveRuntimeState: async () => undefined,
      reportFeatureError: async (...args: unknown[]) => { errors.push(args); },
      memberSpending: { get: async () => { reads++; return null; } } as Partial<MemberSpendingStore>,
    } as unknown as FeatureContext;
    const modules = shopFirst ? [shopStatusFeature, memberSpendingFeature] : [memberSpendingFeature, shopStatusFeature];
    const disposers = [];
    for (const module of modules) disposers.push(await module.activate(context));
    try {
      client.emit("clientReady");
      await settle();
      assert.deepEqual(globalCommands, ["shop"]);
      assert.deepEqual(guildCommands, ["spending"]);
      client.emit("interactionCreate", state.interaction);
      await settle();
      assert.equal(reads, 1);
      assert.equal(state.acknowledgements.length, 1);
      assert.equal(state.edits.length, 1);
      assert.deepEqual(errors, []);
    } finally { for (const dispose of disposers.reverse()) await dispose(); }
  });
}

async function addCard(options: {
  txCount: number;
  monthlyEnabled?: boolean;
  memberAvatar: string | null;
  userAvatar?: string;
  presentations?: Record<string, unknown>;
}) {
  const client = new EventEmitter();
  const sent: Array<Record<string, unknown>> = [];
  const added: Array<{ id: string; amount: number }> = [];
  const replies: string[] = [];
  const user = {
    id: memberId,
    username: "Customer",
    displayAvatarURL: () => options.userAvatar ?? userAvatar,
  };
  const context = {
    client: client as unknown as Client,
    config: { SPENDING_MONTHLY_ENABLED: options.monthlyEnabled ?? true },
    secrets: {},
    presentations: options.presentations ?? {},
    permissions: { canUse: () => true },
    memberSpending: {
      add: async (id: string, amount: number) => {
        added.push({ id, amount });
        return { memberDiscordId: id, amountSatang: 58000, txCount: options.txCount, thisMonthSatang: 32000, thisMonthTxCount: 2 };
      },
    },
  } as unknown as FeatureContext;
  let completed!: () => void;
  const completion = new Promise<void>((resolve) => { completed = resolve; });
  const interaction = {
    commandName: "spending",
    user: {
      id: "333333333333333333",
      displayAvatarURL: () => "https://cdn.discordapp.com/avatars/333333333333333333/admin.png",
    },
    options: {
      getSubcommand: () => "add",
      getUser: () => user,
      getInteger: () => 160,
    },
    guild: {
      members: {
        fetch: async () => {
          if (options.memberAvatar === null) throw new Error("Member lookup failed");
          return { displayName: "Server Customer", displayAvatarURL: () => options.memberAvatar };
        },
      },
    },
    channel: {
      isTextBased: () => true,
      send: async (payload: Record<string, unknown>) => { sent.push(payload); },
    },
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    isRepliable: () => true,
    inGuild: () => true,
    deferReply: async () => { interaction.deferred = true; },
    editReply: async (message: string) => { replies.push(message); completed(); },
  };
  const dispose = await memberSpendingFeature.activate(context);
  try {
    client.emit("interactionCreate", interaction);
    await completion;
    assert.deepEqual(added, [{ id: memberId, amount: 16000 }]);
    assert.deepEqual(replies, ["อัปเดตบัตรสะสมเรียบร้อย"]);
    assert.equal(sent.length, 1);
    return sent[0]!;
  } finally { await dispose(); }
}

const embedCard = { mode: "EMBED", embeds: [{ title: "{{member}}", thumbnail: { url: "{{avatar}}" } }] };

test("first spending card uses the selected customer's server avatar", { timeout: 2000 }, async () => {
  const card = await addCard({ txCount: 1, memberAvatar: guildAvatar, presentations: { first_card: embedCard } });
  assert.deepEqual(card.embeds, [{ title: "Server Customer", thumbnail: { url: guildAvatar } }]);
});

test("returning spending card uses the selected customer's profile when member lookup fails", { timeout: 2000 }, async () => {
  const card = await addCard({ txCount: 2, memberAvatar: null, presentations: { returning_card: embedCard } });
  assert.deepEqual(card.embeds, [{ title: "Customer", thumbnail: { url: userAvatar } }]);
});

test("default spending card keeps the customer's own default avatar", { timeout: 2000 }, async () => {
  const card = await addCard({ txCount: 2, memberAvatar: null, userAvatar: defaultAvatar });
  const embed = (card.embeds as EmbedBuilder[])[0]!.toJSON();
  assert.equal(embed.thumbnail?.url, defaultAvatar);
  assert.match(embed.description!, /160\.00.*580\.00.*2/s);
});

test("Components V2 spending cards render the customer's avatar variable", { timeout: 2000 }, async () => {
  const card = await addCard({ txCount: 2, memberAvatar: guildAvatar, presentations: {
    returning_card: { mode: "COMPONENTS_V2", components: [{ type: 9, components: [{ type: 10, content: "{{member}}" }], accessory: { type: 11, media: { url: "{{avatar}}" } } }] },
  } });
  assert.equal(card.flags, MessageFlags.IsComponentsV2);
  assert.deepEqual(card.components, [{ type: 9, components: [{ type: 10, content: "Server Customer" }], accessory: { type: 11, media: { url: guildAvatar } } }]);
});

test("monthly cards substitute current-month values alongside lifetime totals", async () => {
  const card = await addCard({ txCount: 2, memberAvatar: null, presentations: {
    returning_card: { mode: "EMBED", embeds: [{ description: "{{today}} | {{this_month}} | {{this_month_count}} | {{total}} | {{month}}" }] },
  } });
  const description = (card.embeds as Array<{ description: string }>)[0]!.description;
  assert.match(description, /^160\.00 \| 320\.00 \| 2 \| 580\.00 \| \d{4}-\d{2}$/);
});

test("month boundaries use Thailand time including year rollover", () => {
  assert.equal(spendingMonth(new Date("2026-10-31T16:59:59Z")), "2026-10");
  assert.equal(spendingMonth(new Date("2026-10-31T17:00:00Z")), "2026-11");
  assert.equal(spendingMonth(new Date("2026-12-31T17:00:00Z")), "2027-01");
  assert.equal(spendingMonth(new Date("2028-02-29T17:00:00Z")), "2028-03");
});

for (const month of [undefined, "2026-09", "2026-13"]) {
  test(`monthly leaderboard selection validates input and preserves lifetime queries (${month})`, async () => {
    const client = new EventEmitter();
    const state = spendingInteraction("list");
    const reads: unknown[] = [];
    Object.assign(state.interaction.options, { getString: (key: string) => key === "month" ? month : month === undefined ? "this_month" : null });
    const context = {
      client, config: { SPENDING_MONTHLY_ENABLED: true }, secrets: {}, permissions: { canUse: () => true },
      presentations: { monthly_leaderboard: { mode: "EMBED", embeds: [{ title: "Month {{month}}", description: "{{leaderboard_lines}}" }] } },
      memberSpending: { leaderboard: async (limit: number, period?: string) => { reads.push([limit, period]); return [{ memberDiscordId: memberId, amountSatang: 5000, txCount: 1 }]; } },
    } as unknown as FeatureContext;
    const dispose = await memberSpendingFeature.activate(context);
    try {
      client.emit("interactionCreate", state.interaction); await settle();
      if (month === "2026-13") {
        assert.deepEqual(reads, []);
        assert.match(assertFeatureError(state.edits[0], "Member Spending Card").description, /YYYY-MM/);
      } else {
        assert.deepEqual(reads, [[20, month ?? spendingMonth()]]);
        assert.deepEqual((state.edits[0] as { embeds: unknown[] }).embeds, [{ title: `Month ${month ?? spendingMonth()}`, description: `1. <@${memberId}> — 50.00 บาท · 1 ครั้ง` }]);
      }
    } finally { await dispose(); }
  });
}

function monthlyRoleFixture(reset: boolean) {
  const top1 = "111111111111111111", top5 = "555555555555555555", lifetime = "999999999999999999";
  const members = new Collection<string, GuildMember>();
  const changes: string[] = [];
  const listRequests: Array<{ limit: number; after?: string }> = [];
  const guild = {
    roles: { cache: new Collection([top1, top5, lifetime].map(id => [id, { id }])) },
    members: {
      fetch: async () => { throw new Error("GatewayRateLimitError: Request with opcode 8 was rate limited"); },
      list: async (options: { limit: number; after?: string }) => {
        listRequests.push(options);
        return new Collection([...members.entries()]
          .filter(([id]) => !options.after || BigInt(id) > BigInt(options.after))
          .sort(([a], [b]) => BigInt(a) < BigInt(b) ? -1 : 1)
          .slice(0, options.limit));
      },
      me: { permissions: { has: () => true }, roles: { highest: { comparePositionTo: () => 1 } } },
    },
  };
  for (const [id, held] of [[memberId, [top1, top5, lifetime]], ["333333333333333333", []]] as const) {
    const cache = new Set<string>(held);
    members.set(id, { id, guild, roles: { cache,
      add: async (role: string) => { changes.push(`add:${id}:${role}`); cache.add(role); },
      remove: async (role: string) => { changes.push(`remove:${id}:${role}`); cache.delete(role); },
    } } as unknown as GuildMember);
  }
  const context = { config: { SPENDING_MONTHLY_ENABLED: true, SPENDING_MONTHLY_ROLES_ENABLED: true, SPENDING_MONTHLY_ROLES_RESET: reset,
    SPENDING_MONTHLY_TOP1_ROLE_ID: top1, SPENDING_MONTHLY_TOP5_ROLE_ID: top5, SPENDING_TOP1_ROLE_ID: lifetime } } as unknown as FeatureContext;
  return { top1, top5, lifetime, guild: guild as unknown as Guild, members, changes, listRequests, context };
}

for (const reset of [true, false]) {
  test(`monthly roles follow current ranks and optional role retention (reset: ${reset})`, async () => {
    const fixture = monthlyRoleFixture(reset);
    const reads: unknown[] = [];
    const store = { leaderboard: async (limit: number, month?: string) => {
      reads.push([limit, month]); return [{ memberDiscordId: "333333333333333333", amountSatang: 10000, txCount: 1 }];
    } } as MemberSpendingStore;
    await syncMonthlyRoles(fixture.context, store, fixture.guild);
    assert.deepEqual(reads, [[5, spendingMonth()]]);
    assert.equal(fixture.members.get("333333333333333333")!.roles.cache.has(fixture.top1), true);
    assert.equal(fixture.members.get(memberId)!.roles.cache.has(fixture.top1), !reset);
    assert.equal(fixture.members.get(memberId)!.roles.cache.has(fixture.top5), !reset);
    assert.equal(fixture.members.get(memberId)!.roles.cache.has(fixture.lifetime), true);
  });
}

test("monthly roles reach winners and remove former holders beyond the first REST page without Gateway requests", async () => {
  const f = monthlyRoleFixture(true);
  for (let n = 0; n < 1000; n++) {
    const id = String(100000000000000000n + BigInt(n));
    f.members.set(id, { id, guild: f.guild, roles: { cache: new Set<string>() } } as unknown as GuildMember);
  }
  await syncMonthlyRoles(f.context, {} as MemberSpendingStore, f.guild, [
    { memberDiscordId: "333333333333333333", amountSatang: 10000, txCount: 1 },
    { memberDiscordId: memberId, amountSatang: 5000, txCount: 1 },
  ]);
  assert.deepEqual(f.listRequests, [{ limit: 1000 }, { limit: 1000, after: "100000000000000999" }]);
  assert.equal(f.members.get("333333333333333333")!.roles.cache.has(f.top1), true);
  assert.equal(f.members.get(memberId)!.roles.cache.has(f.top1), false);
  assert.equal(f.members.get(memberId)!.roles.cache.has(f.top5), true);
  assert.equal(f.members.get(memberId)!.roles.cache.has(f.lifetime), true);
});

test("monthly role disposal during a REST member request prevents subsequent role changes", async () => {
  const f = monthlyRoleFixture(true);
  let active = true, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  f.guild.members.list = async () => { await pending; return f.members; };
  const sync = syncMonthlyRoles(f.context, {} as MemberSpendingStore, f.guild, [], () => active);
  await settle();
  active = false; release(); await sync;
  assert.deepEqual(f.changes, []);
});

test("lifetime ranking uses REST even when the full-member Gateway request is rate limited", async () => {
  const f = monthlyRoleFixture(true), client = new EventEmitter(), state = spendingInteraction("rank");
  Object.assign(state.interaction, { guild: f.guild });
  Object.assign(state.interaction.options, { getString: () => null });
  const dispose = await memberSpendingFeature.activate({ ...f.context, client, secrets: {}, presentations: {}, permissions: { canUse: () => true },
    memberSpending: { leaderboard: async () => [{ memberDiscordId: "333333333333333333", amountSatang: 10000, txCount: 1 }] },
  } as unknown as FeatureContext);
  try {
    client.emit("interactionCreate", state.interaction); await settle();
    assert.equal(f.listRequests.length, 1);
    assert.equal(f.members.get("333333333333333333")!.roles.cache.has(f.lifetime), true);
    assert.equal(f.members.get(memberId)!.roles.cache.has(f.lifetime), false);
    assert.equal(state.edits.length, 1);
    assert.doesNotMatch(JSON.stringify(state.edits), /ทำรายการไม่สำเร็จ/);
  } finally { await dispose(); }
});

test("new month removes last month's roles even with no spending, while zero balances never win", async () => {
  const f = monthlyRoleFixture(true);
  await syncMonthlyRoles(f.context, {} as MemberSpendingStore, f.guild, [{ memberDiscordId: memberId, amountSatang: 0, txCount: 10 }]);
  assert.equal(f.members.get(memberId)!.roles.cache.has(f.top1), false);
  assert.equal(f.members.get(memberId)!.roles.cache.has(f.top5), false);
  assert.equal(f.members.get(memberId)!.roles.cache.has(f.lifetime), true);
});

test("disabled monthly roles never access storage or Discord", async () => {
  await syncMonthlyRoles({ config: {} } as FeatureContext, {} as MemberSpendingStore, {} as Guild);
});

test("historical ranking never gives historical winners a current-month role", async () => {
  const f = monthlyRoleFixture(true), client = new EventEmitter(), state = spendingInteraction("rank");
  Object.assign(state.interaction.options, { getString: (key: string) => key === "month" ? "2020-01" : "this_month" });
  let reads = 0;
  const dispose = await memberSpendingFeature.activate({ ...f.context, client, secrets: {}, presentations: {}, permissions: { canUse: () => true },
    memberSpending: { leaderboard: async () => { reads++; return [{ memberDiscordId: memberId, amountSatang: 10000, txCount: 1 }]; } },
  } as unknown as FeatureContext);
  try {
    client.emit("interactionCreate", state.interaction); await settle();
    assert.equal(reads, 1); assert.deepEqual(f.changes, []);
    assert.equal(state.edits.length, 1);
  } finally { await dispose(); }
});

test("monthly roles refresh on startup and every minute, then stop on disposal", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"], now: new Date("2026-10-31T16:59:30Z") });
  const f = monthlyRoleFixture(true);
  const client = Object.assign(new EventEmitter(), { guilds: { fetch: async () => ({ ...f.guild, commands: { create: async () => undefined } }) } });
  const months: string[] = [];
  const dispose = await memberSpendingFeature.activate({ ...f.context, client, guildId: "guild", secrets: {},
    memberSpending: { leaderboard: async (_limit: number, month: string) => { months.push(month); return []; } },
  } as unknown as FeatureContext);
  try {
    client.emit("clientReady"); await settle();
    t.mock.timers.tick(60_000); await settle();
    assert.deepEqual(months, ["2026-10", "2026-11"]);
    await dispose(); t.mock.timers.tick(60_000); await settle();
    assert.equal(months.length, 2);
    assert.equal(client.listenerCount("clientReady"), 0);
  } finally { await dispose(); t.mock.timers.reset(); }
});


test("disposing a feature cancels monthly role changes while a ranking read is pending", async () => {
  const f = monthlyRoleFixture(true);
  const client = Object.assign(new EventEmitter(), { guilds: { fetch: async () => ({ ...f.guild, commands: { create: async () => undefined } }) } });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  const dispose = await memberSpendingFeature.activate({ ...f.context, client, guildId: "guild", secrets: {},
    memberSpending: { leaderboard: async () => { requested = true; await pending; return []; } },
  } as unknown as FeatureContext);
  client.emit("clientReady"); await settle();
  assert.equal(requested, true);
  await dispose(); release(); await settle();
  assert.deepEqual(f.changes, []);
});

test("a monthly role failure does not report a committed balance change as failed", async () => {
  const f = monthlyRoleFixture(true), client = new EventEmitter(), state = spendingInteraction("delete");
  let writes = 0;
  const dispose = await memberSpendingFeature.activate({ ...f.context, client, secrets: {}, presentations: {}, permissions: { canUse: () => true },
    memberSpending: { remove: async () => { writes++; return true; }, leaderboard: async () => { throw new Error("Discord temporarily unavailable"); } },
  } as unknown as FeatureContext);
  try {
    client.emit("interactionCreate", state.interaction); await settle();
    assert.equal(writes, 1);
    const result = assertFeatureError(state.edits[0], "Member Spending Card", "MONTHLY_ROLE_SYNC_FAILED", true).description;
    assert.match(result, /ลบข้อมูล.*แล้ว/);
    assert.match(result, /ลองใหม่อัตโนมัติ/);
    assert.doesNotMatch(result, /ทำรายการไม่สำเร็จ/);
  } finally { await dispose(); }
});

test("disabled monthly tracking renders zero monthly variables while preserving lifetime totals", async () => {
  const card = await addCard({ txCount: 2, memberAvatar: null, monthlyEnabled: false, presentations: {
    returning_card: { mode: "EMBED", embeds: [{ description: "{{this_month}}|{{this_month_count}}|{{month}}|{{total}}" }] },
  } });
  assert.deepEqual(card.embeds, [{ description: "0.00|0||580.00" }]);
});

for (const reset of [true, false]) {
  test(`disabling monthly tracking respects role retention without querying monthly balances (reset: ${reset})`, async () => {
    const f = monthlyRoleFixture(reset);
    f.context.config = { ...f.context.config, SPENDING_MONTHLY_ENABLED: false };
    await syncMonthlyRoles(f.context, {} as MemberSpendingStore, f.guild);
    assert.equal(f.members.get(memberId)!.roles.cache.has(f.top1), !reset);
    assert.equal(f.members.get(memberId)!.roles.cache.has(f.top5), !reset);
    assert.equal(f.members.get(memberId)!.roles.cache.has(f.lifetime), true);
  });
}

test("monthly commands explain disabled tracking without querying storage", async () => {
  const client = new EventEmitter(), state = spendingInteraction("list");
  Object.assign(state.interaction.options, { getString: (key: string) => key === "period" ? "this_month" : null });
  const dispose = await memberSpendingFeature.activate({ client, config: {}, secrets: {}, presentations: {},
    permissions: { canUse: () => true }, memberSpending: {},
  } as unknown as FeatureContext);
  try {
    client.emit("interactionCreate", state.interaction); await settle();
    assert.match(assertFeatureError(state.edits[0], "Member Spending Card", "MONTHLY_TRACKING_DISABLED").description, /รายเดือนปิดอยู่/);
  } finally { await dispose(); }
});

test("external storage receives the saved tracking toggle and start day", async () => {
  const client = new EventEmitter(), state = spendingInteraction("check");
  let received: unknown;
  const module = createMemberSpendingFeature(async (_url, _subject, settings) => {
    received = settings;
    return { get: async () => null, close: async () => undefined } as Awaited<ReturnType<typeof import("../src/features/member-spending/store.js").createOwnDatabaseStore>>;
  });
  const dispose = await module.activate({ client, botId: "bot", config: {
    SPENDING_DB_USE_OWN: true, SPENDING_MONTHLY_ENABLED: true, SPENDING_MONTHLY_START_DAY: 25,
  }, secrets: { SPENDING_DB_URL: "postgresql://shop@example.invalid/shop" }, presentations: {}, permissions: { canUse: () => true },
  } as unknown as FeatureContext);
  try {
    client.emit("interactionCreate", state.interaction); await settle();
    assert.deepEqual(received, { enabled: true, startDay: 25 });
  } finally { await dispose(); }
});

test("monthly ranking roles switch cycles on the configured day in Thailand time", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-24T16:59:59Z") });
  const f = monthlyRoleFixture(true), periods: string[] = [];
  f.context.config = { ...f.context.config, SPENDING_MONTHLY_START_DAY: 25 };
  const store = { leaderboard: async (_limit: number, month: string) => { periods.push(month); return []; } } as MemberSpendingStore;
  try {
    await syncMonthlyRoles(f.context, store, f.guild);
    t.mock.timers.tick(1000);
    await syncMonthlyRoles(f.context, store, f.guild);
    assert.deepEqual(periods, ["2026-09", "2026-10"]);
  } finally { t.mock.timers.reset(); }
});
