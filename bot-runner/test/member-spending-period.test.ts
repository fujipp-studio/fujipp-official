import assert from "node:assert/strict";
import test from "node:test";
import { monthlySettings, spendingMonth } from "../src/features/member-spending/period.js";

for (const [timestamp, day, expected] of [
  ["2026-10-24T16:59:59Z", 25, "2026-09"],
  ["2026-10-24T17:00:00Z", 25, "2026-10"],
  ["2026-01-23T17:00:00Z", 25, "2025-12"],
  ["2026-01-24T17:00:00Z", 25, "2026-01"],
  ["2026-02-27T16:59:59Z", 31, "2026-01"],
  ["2026-02-27T17:00:00Z", 31, "2026-02"],
  ["2028-02-28T16:59:59Z", 31, "2028-01"],
  ["2028-02-28T17:00:00Z", 31, "2028-02"],
  ["2028-03-29T17:00:00Z", 31, "2028-02"],
  ["2028-03-30T17:00:00Z", 31, "2028-03"],
  ["2026-04-29T17:00:00Z", 31, "2026-04"],
  ["2026-10-31T17:00:00Z", 1, "2026-11"],
] as const) {
  test(`monthly cycle day ${day} at ${timestamp} is ${expected}`, () => {
    assert.equal(spendingMonth(new Date(timestamp), day), expected);
  });
}

test("monthly tracking is opt-in and validates cycle-day settings", () => {
  assert.deepEqual(monthlySettings({}), { enabled: false, startDay: 1 });
  assert.deepEqual(monthlySettings({ SPENDING_MONTHLY_ENABLED: true, SPENDING_MONTHLY_START_DAY: 25 }), { enabled: true, startDay: 25 });
  for (const day of [0, 32, 1.5, NaN]) assert.throws(() => spendingMonth(new Date(), day), /1–31/);
});
