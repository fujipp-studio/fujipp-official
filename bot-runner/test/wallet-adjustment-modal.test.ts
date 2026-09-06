import assert from "node:assert/strict";
import test from "node:test";
import { buildWalletAdminCommand,buildWalletAdjustmentModal,parseWalletAdjustmentModalId } from "../src/features/wallet-topup/v1.0.0.js";

test("version 2.1 wallet adjustments select the member before opening the modal", () => {
  const command=buildWalletAdminCommand(true).toJSON();
  const add=command.options?.find((option)=>option.name==="add");

  assert.deepEqual(add?.options?.map((option)=>option.name),["member"]);
});

test("earlier wallet versions keep amount and reason as slash command options", () => {
  const command=buildWalletAdminCommand(false).toJSON();
  const add=command.options?.find((option)=>option.name==="add");

  assert.deepEqual(add?.options?.map((option)=>option.name),["member","amount","reason"]);
});

test("builds the wallet add modal with amount and reason inputs", () => {
  const modal=buildWalletAdjustmentModal("ADD","123456789012345").toJSON();

  assert.equal(modal.custom_id,"fujipp:wallet:admin-adjust:ADD:123456789012345");
  assert.equal(modal.title,"เพิ่มยอดเงิน");
  assert.equal(modal.components.length,2);
  assert.equal(modal.components[0]?.components[0]?.custom_id,"amount");
  assert.equal(modal.components[1]?.components[0]?.custom_id,"reason");
  assert.equal(modal.components[1]?.components[0]?.max_length,300);
});

test("parses only valid wallet adjustment modal identifiers", () => {
  assert.deepEqual(parseWalletAdjustmentModalId("fujipp:wallet:admin-adjust:REMOVE:123456789012345"),{
    operation:"REMOVE",
    memberId:"123456789012345",
  });
  assert.equal(parseWalletAdjustmentModalId("fujipp:wallet:admin-adjust:CREDIT:123456789012345"),null);
  assert.equal(parseWalletAdjustmentModalId("fujipp:wallet:admin-adjust:ADD:not-a-member"),null);
});
