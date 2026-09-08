import assert from "node:assert/strict";
import test from "node:test";
import { deliverPayoutNotificationCopies,payoutMemberReceiptSlot,payoutReceiptValues,shouldSendPayoutReceiptToMember } from "../src/features/roblox-robux-payout/v1.0.0.js";

test("sends member receipts only for successful Robux payouts", () => {
  assert.equal(shouldSendPayoutReceiptToMember(true,"SUCCEEDED"),true);
  assert.equal(shouldSendPayoutReceiptToMember(true,"REFUNDED"),false);
  assert.equal(shouldSendPayoutReceiptToMember(true,"REVIEW_REQUIRED"),false);
  assert.equal(shouldSendPayoutReceiptToMember(false,"SUCCEEDED"),false);
});

test("uses the dedicated receipt presentation for successful version 2.2 payouts", () => {
  assert.equal(payoutMemberReceiptSlot(true,"SUCCEEDED","receipt"),"receipt");
  assert.equal(payoutMemberReceiptSlot(true,"REFUNDED","receipt"),null);
  assert.equal(payoutMemberReceiptSlot(false,"SUCCEEDED","receipt"),null);
});

test("limits the member receipt values to the four purchase details", () => {
  assert.deepEqual(payoutReceiptValues(
    {robuxAmount:400,priceSatang:11500},
    "Main Group",
    "8 ก.ย. 2569 12:34:56",
  ),{
    package:"400 Robux",
    price:"115.00",
    group_name:"Main Group",
    transaction_time:"8 ก.ย. 2569 12:34:56",
  });
});

test("delivers a Robux payout notification to the audit channel, receipt channel, and member DM", async () => {
  const deliveries:string[]=[];

  await deliverPayoutNotificationCopies({
    channelId:"123456789012345",
    sendToChannel:async(channelId)=>{deliveries.push(`channel:${channelId}`);},
    receiptChannelId:"234567890123456",
    sendToReceiptChannel:async(channelId)=>{deliveries.push(`receipt:${channelId}`);},
    sendToMember:async()=>{deliveries.push("member");},
  });

  assert.deepEqual(deliveries.sort(),["channel:123456789012345","member","receipt:234567890123456"]);
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

test("delivers to the receipt channel even when no audit channel is configured", async () => {
  const deliveries:string[]=[];

  await deliverPayoutNotificationCopies({
    channelId:"",
    sendToChannel:async()=>{deliveries.push("audit");},
    receiptChannelId:"234567890123456",
    sendToReceiptChannel:async(channelId)=>{deliveries.push(`receipt:${channelId}`);},
  });

  assert.deepEqual(deliveries,["receipt:234567890123456"]);
});

test("keeps notification delivery failures isolated from payout completion", async () => {
  const failures:string[]=[];

  await assert.doesNotReject(deliverPayoutNotificationCopies({
    channelId:"123456789012345",
    sendToChannel:async()=>{throw new Error("channel unavailable");},
    receiptChannelId:"234567890123456",
    sendToReceiptChannel:async()=>{throw new Error("receipt channel unavailable");},
    sendToMember:async()=>{throw new Error("DM closed");},
    onError:(target)=>{failures.push(target);},
  }));

  assert.deepEqual(failures.sort(),["channel","member","receipt_channel"]);
});
