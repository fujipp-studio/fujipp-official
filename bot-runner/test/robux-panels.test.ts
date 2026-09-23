import assert from "node:assert/strict";
import test from "node:test";
import { readPayoutPanels,robuxPriceSatang } from "../src/features/roblox-robux-payout/v1.0.0.js";

const groups=[{key:"group-1"},{key:"group-2"},{key:"group-3"}];

test("reads independent Robux panels and ignores unknown groups",()=>{
  assert.deepEqual(readPayoutPanels([
    {key:"panel-1",name:"Panel 1",groupKeys:["group-1","group-2","missing"]},
    {key:"panel-2",name:"Panel 2",groupKeys:["group-3"]},
  ],groups),[
    {key:"panel-1",name:"Panel 1",groupKeys:["group-1","group-2"]},
    {key:"panel-2",name:"Panel 2",groupKeys:["group-3"]},
  ]);
});

test("falls back to one panel containing all configured groups",()=>{
  assert.deepEqual(readPayoutPanels([],groups),[
    {key:"main",name:"Main Panel",groupKeys:["group-1","group-2","group-3"]},
  ]);
});

test("does not expose every group when a non-empty panel configuration is invalid",()=>{
  assert.deepEqual(readPayoutPanels([{key:"empty",name:"Empty",groupKeys:[]}],groups),[]);
});

test("calculates a different package price for each group rate",()=>{
  assert.equal(robuxPriceSatang(400,4),10_000);
  assert.equal(robuxPriceSatang(400,3.5),11_500);
});
