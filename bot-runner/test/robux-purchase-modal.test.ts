import assert from "node:assert/strict";
import test from "node:test";
import { buildPurchaseUsernameModal } from "../src/features/roblox-robux-payout/v1.0.0.js";
import { ROBUX_PAYOUT_V201_PURCHASE_FORM } from "../src/features/roblox-robux-payout/v2.0.1.js";

test("Robux payout 2.0.1 expands and renames the purchase username form", () => {
  const modal=buildPurchaseUsernameModal(
    {key:"group-1",name:"Group 1"},
    ROBUX_PAYOUT_V201_PURCHASE_FORM.maxLength,
    ROBUX_PAYOUT_V201_PURCHASE_FORM.title,
  ).toJSON();

  assert.equal(modal.title,"กรอกชื่อเติม Robux (Group 1)");
  assert.equal(modal.components[0]?.components[0]?.max_length,50);
});
