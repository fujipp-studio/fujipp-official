import assert from "node:assert/strict";
import test from "node:test";
import { readPayoutPanels,robuxPriceSatang } from "../src/features/roblox-robux-payout/v1.0.0.js";

const groups=[{key:"group-1"},{key:"group-2"},{key:"group-3"}];

test("reads independent Robux panels and ignores unknown groups",()=>{
  assert.deepEqual(readPayoutPanels([
    {key:"panel-1",name:"Panel 1",groupKeys:["group-1","group-2","missing"],presentationSlot:"panel_2",mode:"membership_only"},
    {key:"panel-2",name:"Panel 2",groupKeys:["group-3"],presentationSlot:"panel_1",mode:"storefront"},
  ],groups),[
    {key:"panel-1",name:"Panel 1",groupKeys:["group-1","group-2"],slotKey:"panel_2",mode:"membership_only"},
    {key:"panel-2",name:"Panel 2",groupKeys:["group-3"],slotKey:"panel_1",mode:"storefront"},
  ]);
});

test("falls back to one panel containing all configured groups",()=>{
  assert.deepEqual(readPayoutPanels([],groups),[
    {key:"main",name:"Main Panel",groupKeys:["group-1","group-2","group-3"],slotKey:"panel_1",mode:"storefront"},
  ]);
});

test("does not expose every group when a non-empty panel configuration is invalid",()=>{
  assert.deepEqual(readPayoutPanels([{key:"empty",name:"Empty",groupKeys:[]}],groups),[]);
});

test("keeps each panel presentation slot stable",()=>{
  assert.deepEqual(readPayoutPanels([
    {key:"remaining",name:"Remaining",groupKeys:["group-3"],presentationSlot:"panel_2"},
  ],groups),[
    {key:"remaining",name:"Remaining",groupKeys:["group-3"],slotKey:"panel_2",mode:"storefront"},
  ]);
});

test("falls back to storefront mode for existing and invalid panel modes",()=>{
  assert.deepEqual(readPayoutPanels([
    {key:"legacy",name:"Legacy",groupKeys:["group-1"],presentationSlot:"panel_1"},
    {key:"invalid",name:"Invalid",groupKeys:["group-2"],presentationSlot:"panel_2",mode:"anything"},
  ],groups).map((panel)=>panel.mode),["storefront","storefront"]);
});

test("calculates a different package price for each group rate",()=>{
  assert.equal(robuxPriceSatang(400,4),10_000);
  assert.equal(robuxPriceSatang(400,3.5),11_500);
});
