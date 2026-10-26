import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { MessageFlags, type Interaction, type RepliableInteraction } from "discord.js";
import { featureErrorPayload, replyFeatureError } from "../src/features/errors.js";
import { adminMessageToolsFeature } from "../src/features/admin-message-tools/index.js";
import { voiceKeeperFeature } from "../src/features/voice-keeper/index.js";
import { reviewCreditFeature } from "../src/features/review-credit/index.js";
import { walletTopupFeatureV21 } from "../src/features/wallet-topup/index.js";
import { robloxRobuxPayoutFeatureV3 } from "../src/features/roblox-robux-payout/index.js";
import { robloxPayoutTestFeature } from "../src/features/roblox-payout-test/index.js";
import type { FeatureContext, FeatureModule } from "../src/types.js";
import { assertFeatureError } from "./assert-feature-error.js";

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

function interaction(commandName = "test", subcommand = "leave") {
  const replies: unknown[] = [], edits: unknown[] = [], followUps: unknown[] = [];
  const value = {
    commandName, guildId: "guild", customId: "", deferred: false, replied: false,
    user: { id: "user", displayAvatarURL: () => "https://example.com/avatar.png" },
    options: { getSubcommand: () => subcommand, getString: () => "", getUser: () => ({ id: "user" }) },
    memberPermissions: { has: () => true },
    isChatInputCommand: () => true, isButton: () => false, isModalSubmit: () => false,
    isStringSelectMenu: () => false, isAutocomplete: () => false, isRepliable: () => true, inGuild: () => true,
    reply: async (payload: unknown) => { replies.push(payload); value.replied = true; },
    editReply: async (payload: unknown) => { edits.push(payload); },
    followUp: async (payload: unknown) => { followUps.push(payload); },
    deferReply: async () => { value.deferred = true; },
  };
  return { value, replies, edits, followUps };
}

test("error details cannot expose connection credentials, auth tokens, stacks or ping users", () => {
  const error = new Error("postgresql://shop:super-secret@db.example/shop?sslmode=require\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz\npassword=private-value\n    at database (private.js:12)");
  const payload = featureErrorPayload("member-spending", error);
  const embed = assertFeatureError(payload, "Member Spending Card");
  const text = JSON.stringify(payload);
  assert.doesNotMatch(text, /super-secret|private-value|abcdefghijklmnopqrstuvwxyz|private\.js/);
  assert.match(embed.description, /\[database connection\]/);
  assert.match(embed.fields![1]!.value, /อย่าเพิ่มรายการเดิมซ้ำ/);
});

test("oversized and unknown failures always produce a valid bounded Embed", () => {
  const payload = featureErrorPayload("message-sets", new Error("x".repeat(10000)), { code: "x".repeat(500) });
  const embed = assertFeatureError(payload, "Message Sets");
  assert.ok(embed.description.length <= 4096);
  assert.ok(embed.fields!.every(field => field.value.length <= 1024));
  assert.ok(assertFeatureError(featureErrorPayload("voice-keeper", null), "Voice Keeper").description.length > 0);
});

test("Discord permissions and rate limits offer actionable error details", () => {
  const permission = featureErrorPayload("member-spending", Object.assign(new Error("Missing Permissions"), { code: 50013 }));
  assert.match(assertFeatureError(permission, "Member Spending Card", "50013").fields![1]!.value, /ลำดับยศ/);
  const rate = featureErrorPayload("member-spending", Object.assign(new Error("rate limited"), { name: "GatewayRateLimitError" }));
  assert.match(assertFeatureError(rate, "Member Spending Card", "DISCORD_RATE_LIMITED").fields![1]!.value, /รอสักครู่/);
});

for (const acknowledged of [false, true]) {
  test(`errors acknowledge once and preserve deferred response visibility (deferred: ${acknowledged})`, async () => {
    const state = interaction(); state.value.deferred = acknowledged;
    await replyFeatureError(state.value as unknown as RepliableInteraction, "message-sets", new Error("bad SET"));
    assert.equal(state.replies.length, acknowledged ? 0 : 1);
    assert.equal(state.edits.length, acknowledged ? 1 : 0);
    const payload = (acknowledged ? state.edits : state.replies)[0] as { content: unknown; flags: number };
    assertFeatureError(payload, "Message Sets");
    if (acknowledged) assert.equal(payload.content, null);
    else assert.equal(payload.flags, MessageFlags.Ephemeral);
  });
}

test("a Components V2 reply that cannot become an Embed receives a private follow-up", async () => {
  const state = interaction(); state.value.replied = true;
  state.value.editReply = async () => { throw new Error("Cannot convert Components V2"); };
  await replyFeatureError(state.value as unknown as RepliableInteraction, "payment-trigger", "payment failed");
  assert.equal(state.followUps.length, 1);
  assertFeatureError(state.followUps[0], "Payment Trigger");
  assert.equal((state.followUps[0] as { flags: number }).flags, MessageFlags.Ephemeral);
});

test("a deleted response or expired interaction never creates an unhandled error loop", async () => {
  const state = interaction(); state.value.replied = true;
  state.value.editReply = async () => { throw new Error("deleted"); };
  state.value.followUp = async () => { throw new Error("expired"); };
  await assert.doesNotReject(replyFeatureError(state.value as unknown as RepliableInteraction, "shop-status", "failed"));
});

function context(client: EventEmitter): FeatureContext {
  return {
    client, botId: "bot", installationId: "install", guildId: "guild",
    config: { REVIEW_CHANNEL_ID: "111111111111111111" }, secrets: {}, presentations: {}, runtimeState: {},
    permissions: { canUse: () => true },
    reportFeatureError: async () => undefined,
    saveRuntimeState: async () => { throw new Error("State unavailable"); },
  } as unknown as FeatureContext;
}

for (const [module, command, name, setup] of [
  [adminMessageToolsFeature, "dm", "Admin Message Tools", (c: FeatureContext) => { c.config.ADMIN_TOOLS_DM_ENABLED = false; }],
  [voiceKeeperFeature, "voice", "Voice Keeper", () => undefined],
  [reviewCreditFeature, "review", "Review Credit", (c: FeatureContext) => { Object.assign(c.client, { channels: { fetch: async () => { throw new Error("Channel unavailable"); } } }); }],
  [robloxRobuxPayoutFeatureV3, "robux-panel", "Robux Payout", (c: FeatureContext) => { c.permissions = { canUse: () => false }; }],
  [robloxPayoutTestFeature, "robux-payout-test", "Roblox Payout Test", () => undefined],
] as const satisfies ReadonlyArray<readonly [FeatureModule, string, string, (c: FeatureContext) => void]>) {
  test(`${name} handles its own command failure with an Embed`, async () => {
    const client = new EventEmitter(), c = context(client), state = interaction(command);
    setup(c);
    const dispose = await module.activate(c);
    try {
      client.emit("interactionCreate", state.value as unknown as Interaction); await settle();
      assert.equal(state.replies.length + state.edits.length, 1);
      assertFeatureError(state.edits[0] ?? state.replies[0], name);
    } finally { await dispose(); }
  });
}

test("Wallet errors use an Embed by default, preserve custom designs and recover if those fail", async () => {
  for (const design of ["default", "custom", "broken"]) {
    const client = new EventEmitter(), c = context(client), state = interaction();
    if (design !== "default") c.presentations = { failed: { mode: "EMBED", embeds: [{ title: "Custom failure", description: "{{failure_reason}}" }] } };
    c.wallet = { balance: async () => { throw new Error("Wallet unavailable"); } } as FeatureContext["wallet"];
    state.value.isChatInputCommand = () => false; state.value.isButton = () => true;
    state.value.customId = "fujipp:wallet:balance";
    const reply = state.value.reply;
    state.value.reply = async payload => {
      if (design === "broken" && (payload as { embeds: Array<{ title: string }> }).embeds[0]?.title === "Custom failure") throw new Error("Invalid template");
      await reply(payload);
    };
    const dispose = await walletTopupFeatureV21.activate(c);
    try {
      client.emit("interactionCreate", state.value); await settle();
      assert.equal(state.replies.length, 1);
      if (design !== "custom") assertFeatureError(state.replies[0], "Wallet Top-up");
      else assert.equal((state.replies[0] as { embeds: Array<{ title: string }> }).embeds[0]?.title, "Custom failure");
    } finally { await dispose(); }
  }
});

test("Wallet never replies to another feature's command with a permission error", async () => {
  const client = new EventEmitter(), c = context(client), state = interaction("spending");
  c.permissions = { canUse: () => { throw new Error("must not check another feature's permissions"); } };
  const dispose = await walletTopupFeatureV21.activate(c);
  try {
    client.emit("interactionCreate", state.value); await settle();
    assert.deepEqual(state.replies, []); assert.deepEqual(state.edits, []);
  } finally { await dispose(); }
});

test("a failed Wallet write is acknowledged with an Embed without retrying the financial operation", async () => {
  const client = new EventEmitter(), c = context(client), state = interaction(), writes: unknown[] = [];
  c.wallet = { voucher: async (input: unknown) => { writes.push(input); throw new Error("Provider unavailable"); } } as FeatureContext["wallet"];
  state.value.isChatInputCommand = () => false; state.value.isModalSubmit = () => true;
  Object.assign(state.value, { id: "voucher-test", customId: "wallet:voucher", fields: { getTextInputValue: () => "https://example.com/gift" } });
  const dispose = await walletTopupFeatureV21.activate(c);
  try {
    client.emit("interactionCreate", state.value); await settle();
    assert.deepEqual(writes, [{ memberDiscordId: "user", giftUrl: "https://example.com/gift", idempotencyKey: "discord:voucher-test" }]);
    assert.equal(state.value.deferred, true);
    assert.equal(state.edits.length, 1);
    assertFeatureError(state.edits[0], "Wallet Top-up", "RUNTIME_ERROR");
    assert.deepEqual(state.replies, []);
  } finally { await dispose(); }
});
