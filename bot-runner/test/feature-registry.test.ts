import assert from "node:assert/strict";
import test from "node:test";
import { getFeature } from "../src/feature-registry.js";

test("resolves a bundled feature by exact runtime key and version", () => {
  const feature = getFeature("voice-keeper", "1.0.0");

  assert.equal(feature?.runtimeKey, "voice-keeper");
  assert.equal(feature?.version, "1.0.0");
});

test("does not fall forward to another feature version", () => {
  assert.equal(getFeature("voice-keeper", "1.0.1"), undefined);
});

test("resolves bot presence version 1.0.0", () => {
  const feature = getFeature("bot-presence", "1.0.0");

  assert.equal(feature?.runtimeKey, "bot-presence");
  assert.equal(feature?.version, "1.0.0");
  assert.deepEqual(feature?.intents, []);
});

test("resolves review credit version 1.0.0", () => {
  const feature = getFeature("review-credit", "1.0.0");

  assert.equal(feature?.runtimeKey, "review-credit");
  assert.equal(feature?.version, "1.0.0");
  assert.deepEqual(feature?.intents, ["Guilds", "GuildMessages"]);
});

test("resolves wallet top-up version 1.0.0", () => {
  assert.equal(getFeature("wallet-topup", "1.0.0")?.runtimeKey, "wallet-topup");
});

test("resolves wallet top-up version 2.0.0 without replacing version 1", () => {
  const feature = getFeature("wallet-topup", "2.0.0");
  assert.equal(feature?.version, "2.0.0");
  assert.deepEqual(feature?.intents, ["Guilds", "GuildMessages", "MessageContent", "GuildMembers"]);
});

test("resolves Roblox Robux payout version 1.0.0", () => {
  assert.equal(getFeature("roblox-robux-payout", "1.0.0")?.runtimeKey, "roblox-robux-payout");
});

test("resolves Roblox Robux payout version 2.0.0 without replacing version 1", () => {
  const feature = getFeature("roblox-robux-payout", "2.0.0");
  assert.equal(feature?.runtimeKey, "roblox-robux-payout");
  assert.equal(feature?.version, "2.0.0");
});

test("resolves Roblox Robux payout version 2.0.1 without replacing earlier versions", () => {
  const feature = getFeature("roblox-robux-payout", "2.0.1");
  assert.equal(feature?.runtimeKey, "roblox-robux-payout");
  assert.equal(feature?.version, "2.0.1");
  assert.equal(getFeature("roblox-robux-payout", "2.0.0")?.version, "2.0.0");
});

test("resolves Price Reader version 1.0.0 with message content intent", () => {
  const feature = getFeature("price-reader", "1.0.0");

  assert.equal(feature?.runtimeKey, "price-reader");
  assert.equal(feature?.version, "1.0.0");
  assert.deepEqual(feature?.intents, ["Guilds", "GuildMessages", "MessageContent"]);
});

test("resolves Price Reader version 2.0.0 without replacing version 1", () => {
  const feature = getFeature("price-reader", "2.0.0");

  assert.equal(feature?.runtimeKey, "price-reader");
  assert.equal(feature?.version, "2.0.0");
  assert.deepEqual(feature?.intents, ["Guilds", "GuildMessages", "MessageContent"]);
});

test("resolves Admin Message Tools version 1.0.0", () => {
  const feature = getFeature("admin-message-tools", "1.0.0");

  assert.equal(feature?.runtimeKey, "admin-message-tools");
  assert.equal(feature?.version, "1.0.0");
  assert.deepEqual(feature?.intents, ["Guilds"]);
});

test("resolves Runtime Expiry Alert version 1.0.0", () => {
  const feature = getFeature("runtime-expiry-alert", "1.0.0");
  assert.equal(feature?.runtimeKey, "runtime-expiry-alert");
  assert.equal(feature?.version, "1.0.0");
  assert.deepEqual(feature?.intents, ["Guilds"]);
});

test("resolves Member Spending version 1.0.0 with member intent", () => {
  const feature = getFeature("member-spending", "1.0.0");
  assert.equal(feature?.runtimeKey, "member-spending");
  assert.deepEqual(feature?.intents, ["Guilds", "GuildMembers"]);
});

test("resolves Bot Permissions as a bundled core feature", () => {
  const feature = getFeature("bot-permissions", "1.0.0");
  assert.ok(feature);
  assert.equal(feature.runtimeKey, "bot-permissions");
});
