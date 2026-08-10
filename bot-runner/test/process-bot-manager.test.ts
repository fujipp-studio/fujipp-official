import assert from "node:assert/strict";
import test from "node:test";
import { rpcBelongsToBot, workerEnvironment } from "../src/process-bot-manager.js";

test("worker environment never receives runner credentials", () => {
  const environment = workerEnvironment({ RUNNER_API_TOKEN: "current", RUNNER_API_PREVIOUS_TOKEN: "old", SAFE: "yes" }, "bot-a");
  assert.equal(environment.RUNNER_API_TOKEN, undefined);
  assert.equal(environment.RUNNER_API_PREVIOUS_TOKEN, undefined);
  assert.equal(environment.BOT_WORKER_ID, "bot-a");
  assert.equal(environment.SAFE, "yes");
});

test("supervisor rejects RPC calls for another bot", () => {
  assert.equal(rpcBelongsToBot("bot-a", "walletBalance", ["bot-a", "member"]), true);
  assert.equal(rpcBelongsToBot("bot-a", "walletBalance", ["bot-b", "member"]), false);
  assert.equal(rpcBelongsToBot("bot-a", "reportStatus", [{ botId: "bot-a", status: "RUNNING" }]), true);
  assert.equal(rpcBelongsToBot("bot-a", "reportStatus", [{ botId: "bot-b", status: "RUNNING" }]), false);
});
