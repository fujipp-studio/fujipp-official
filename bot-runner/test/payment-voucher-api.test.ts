import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeApiClient } from "../src/api-client.js";

test("Payment Trigger redemption uses the direct voucher endpoint and invoice scope, never the Wallet credit endpoint", async (t) => {
  const input = { memberDiscordId: "123456789012345678", giftUrl: "https://gift.truemoney.com/campaign/?v=testVoucher",
    paymentMessageId: "223456789012345678", expectedAmountSatang: 10000, idempotencyKey: "payment:test-123" };
  const response = { id: "redemption-1", status: "SUCCEEDED", amountSatang: 10000 };
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    requests++;
    assert.equal(url.pathname, "/internal/v1/vouchers/truemoney/redeem");
    assert.equal(init.method, "POST");
    const { giftUrl, ...invoice } = input;
    assert.deepEqual(JSON.parse(String(init.body)), { botId: "bot-a", ...invoice, gift_url: giftUrl });
    return Response.json(response);
  });
  const api = new RuntimeApiClient("https://backend.test", "test-runner-token");
  assert.deepEqual(await api.paymentVoucher("bot-a", input), response);
  const spoofedInput = { ...input, botId: "bot-b" };
  assert.deepEqual(await api.paymentVoucher("bot-a", spoofedInput), response);
  assert.equal(requests, 2);
});
