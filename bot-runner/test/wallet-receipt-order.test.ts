import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { FeatureContext } from "../src/types.js";
import { walletTopupFeature } from "../src/features/wallet-topup/v1.0.0.js";

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
for (const created of [true, false]) {
  test(`customer receipt precedes slow Discord work; created=${created}`, async () => {
    const operations: string[] = [];
    let release!: () => void;
    const role = new Promise<void>((resolve) => { release = resolve; });
    const client = Object.assign(new EventEmitter(), {
      channels: { fetch: async () => ({ isTextBased: () => true, isSendable: () => true, send: async () => { operations.push("notification"); } }) },
    });
    const context = {
      client, botId: "synthetic-bot", installationId: `synthetic-install-${created}`, config: {
        TOPUP_MEMBER_ROLE_ID: "111111111111111111", TOPUP_NOTIFICATION_CHANNEL_ID: "222222222222222222",
      }, runtimeState: {}, presentations: {}, reportFeatureError: async () => { operations.push("error"); },
      wallet: { voucher: async () => { operations.push("ledger"); return { transactionId: "synthetic", creditedSatang: 199500, balanceSatang: 199500, method: "TRUEMONEY", currency: "THB", created, completedAt: new Date().toISOString() }; } },
    } as unknown as FeatureContext;
    const dispose = await walletTopupFeature.activate(context);
    try {
      client.emit("interactionCreate", {
        isChatInputCommand: () => false, isButton: () => false, isModalSubmit: () => true,
        customId: "wallet:voucher", id: "synthetic", user: { id: "333333333333333333" },
        fields: { getTextInputValue: () => "https://gift.truemoney.com/campaign/?v=synthetic" },
        deferReply: async () => { operations.push("defer"); }, editReply: async () => { operations.push("receipt"); },
        guild: { members: { fetch: async () => { operations.push("role-lookup"); await role; return { roles: { cache: { has: () => false }, add: async () => { operations.push("role-added"); } } }; } } },
      });
      await settle();
      assert.deepEqual(operations, ["defer", "ledger", "receipt", "role-lookup"]);
      release(); await settle();
      assert.equal(operations.includes("role-added"), true);
      assert.equal(operations.includes("notification"), created);
      assert.equal(operations.includes("error"), false);
    } finally { release(); await dispose(); }
  });
}
