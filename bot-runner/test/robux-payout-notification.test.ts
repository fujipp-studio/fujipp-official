import assert from "node:assert/strict";
import test from "node:test";
import { deliverPayoutNotificationCopies,shouldSendPayoutReceiptToMember } from "../src/features/roblox-robux-payout/v1.0.0.js";

test("sends member receipts only for successful Robux payouts", () => {
  assert.equal(shouldSendPayoutReceiptToMember(true,"SUCCEEDED"),true);
  assert.equal(shouldSendPayoutReceiptToMember(true,"REFUNDED"),false);
  assert.equal(shouldSendPayoutReceiptToMember(true,"REVIEW_REQUIRED"),false);
  assert.equal(shouldSendPayoutReceiptToMember(false,"SUCCEEDED"),false);
});

test("delivers a Robux payout notification to the audit channel and member DM", async () => {
  const deliveries:string[]=[];

  await deliverPayoutNotificationCopies({
    channelId:"123456789012345",
    sendToChannel:async(channelId)=>{deliveries.push(`channel:${channelId}`);},
    sendToMember:async()=>{deliveries.push("member");},
  });

  assert.deepEqual(deliveries.sort(),["channel:123456789012345","member"]);
});

test("delivers the member DM even when no audit channel is configured", async () => {
  let channelCalls=0;
  let memberCalls=0;

  await deliverPayoutNotificationCopies({
    channelId:"",
    sendToChannel:async()=>{channelCalls+=1;},
    sendToMember:async()=>{memberCalls+=1;},
  });

  assert.equal(channelCalls,0);
  assert.equal(memberCalls,1);
});

test("keeps notification delivery failures isolated from payout completion", async () => {
  const failures:string[]=[];

  await assert.doesNotReject(deliverPayoutNotificationCopies({
    channelId:"123456789012345",
    sendToChannel:async()=>{throw new Error("channel unavailable");},
    sendToMember:async()=>{throw new Error("DM closed");},
    onError:(target)=>{failures.push(target);},
  }));

  assert.deepEqual(failures.sort(),["channel","member"]);
});
