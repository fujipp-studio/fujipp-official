import assert from "node:assert/strict";
import test from "node:test";
import { fulfillRoleShopPurchase, isDefinitiveRoleFailure, roleShopProducts } from "../src/features/role-shop/v1.0.0.js";
import type { FeatureContext, RoleShopPurchase } from "../src/types.js";

const product={key:"vip",name:"VIP",roleId:"333333333333333333",priceSatang:10025};
const job: RoleShopPurchase={id:"purchase-1",memberDiscordId:"222222222222222222",productKey:"vip",productName:"VIP",roleId:product.roleId,
  priceSatang:10025,status:"DEBITED",balanceSatang:9975,claimToken:null,createdAt:"2026-10-27T00:00:00Z"};
function fixture(options: {owned?:boolean; grantError?:unknown; completeError?:unknown; editable?:boolean}={}) {
  const calls:string[]=[];
  const claimed={...job,status:"PROCESSING" as const,claimToken:"token-1"};
  const member={roles:{cache:new Set(options.owned?[product.roleId]:[]),add:async()=>{calls.push("grant");if(options.grantError)throw options.grantError;}}};
  const guild={id:"111111111111111111",members:{fetch:async(options:unknown)=>{assert.deepEqual(options,{user:job.memberDiscordId,force:true});return member;},fetchMe:async()=>({permissions:{has:()=>true}})},roles:{fetch:async()=>({id:product.roleId,managed:false,editable:options.editable??true})}};
  const context={guildId:guild.id,client:{guilds:{fetch:async()=>guild}},roleShop:{
    claim:async(id:string)=>{assert.equal(id,job.id);calls.push("claim");return claimed;},
    complete:async(id:string,token:string)=>{assert.equal(id,job.id);assert.equal(token,"token-1");calls.push("complete");if(options.completeError)throw options.completeError;return {...claimed,status:"SUCCEEDED" as const};},
    refund:async(id:string,token:string)=>{assert.equal(id,job.id);assert.equal(token,"token-1");calls.push("refund");return {...claimed,status:"REFUNDED" as const};},
  },reportFeatureError:async()=>{calls.push("report");}} as unknown as FeatureContext;
  return {context,calls};
}
test("role products reject duplicate roles, invalid prices, unsafe integers and malformed IDs",()=>{
  assert.deepEqual(roleShopProducts([product]),[product]);
  for(const invalid of [[product,{...product,key:"vip2"}], [{...product,priceSatang:0}], [{...product,priceSatang:100.5}],
    [{...product,priceSatang:Number.MAX_SAFE_INTEGER+1}], [{...product,roleId:"@everyone"}]])
    assert.throws(()=>roleShopProducts(invalid));
});
test("purchases claim, grant exactly one role and persist completion",async()=>{
  const {context,calls}=fixture();
  assert.equal((await fulfillRoleShopPurchase(context,job))?.status,"SUCCEEDED");
  assert.deepEqual(calls,["claim","grant","complete"]);
});
test("restart recovery completes an already granted role without granting or charging again",async()=>{
  const {context,calls}=fixture({owned:true,editable:false});
  assert.equal((await fulfillRoleShopPurchase(context,job))?.status,"SUCCEEDED");
  assert.deepEqual(calls,["claim","complete"]);
});
test("definitive Discord rejection refunds the purchase",async()=>{
  const {context,calls}=fixture({grantError:{status:403}});
  assert.equal((await fulfillRoleShopPurchase(context,job))?.status,"REFUNDED");
  assert.deepEqual(calls,["claim","grant","refund"]);
});
test("changed role hierarchy is detected and refunded before delivery",async()=>{
  const {context,calls}=fixture({editable:false});
  assert.equal((await fulfillRoleShopPurchase(context,job))?.status,"REFUNDED");
  assert.deepEqual(calls,["claim","refund"]);
});
test("timeouts and rate limits leave the durable purchase for recovery",async()=>{
  for (const grantError of [new Error("timeout"),{status:429},{status:502}]) {
    const {context,calls}=fixture({grantError});
    assert.equal(await fulfillRoleShopPurchase(context,job),null);
    assert.deepEqual(calls,["claim","grant","report"]);
    assert.equal(isDefinitiveRoleFailure(grantError),false);
  }
});
test("a lost completion response never refunds a role already delivered",async()=>{
  const {context,calls}=fixture({completeError:new Error("connection lost")});
  assert.equal(await fulfillRoleShopPurchase(context,job),null);
  assert.deepEqual(calls,["claim","grant","complete","report"]);
});
