import assert from "node:assert/strict";
import test from "node:test";
import axios,{AxiosError,type AxiosRequestConfig,type AxiosResponse} from "axios";
import { payout,type RobloxGroup } from "../src/features/roblox-robux-payout/roblox-client.js";

const group:RobloxGroup={key:"main",name:"Main",groupId:123,cookie:"a-valid-looking-security-cookie",totpSecret:"JBSWY3DPEHPK3PXP"};
const response=(data:unknown,status=200,headers:Record<string,string>={}):AxiosResponse=>({data,status,statusText:String(status),headers,config:{headers:{}} as AxiosRequestConfig});
const failure=(data:unknown,status=403,headers:Record<string,string>={})=>new AxiosError("Request failed",undefined,undefined,undefined,response(data,status,headers));

test("payout follows the Axios legacy client CSRF and 2FA flow",async(t)=>{
  const calls:Array<{url:string;data:unknown;config:AxiosRequestConfig|undefined}>=[];
  const metadata=Buffer.from(JSON.stringify({challengeId:"verify-id",userId:42})).toString("base64");
  const outcomes:Array<AxiosResponse|Error>=[
    failure({errors:[{code:0,message:"Token Validation Failed"}]},403,{"x-csrf-token":"csrf"}),
    failure({errors:[{code:0,message:"Challenge is required"}]},403,{"rblx-challenge-id":"outer-id","rblx-challenge-type":"twostepverification","rblx-challenge-metadata":metadata}),
    response({verificationToken:"verified"}),
    response({challengeId:"outer-id"}),
    response({}),
  ];
  t.mock.method(axios,"post",async(url,data,config)=>{calls.push({url:String(url),data,config});const outcome=outcomes.shift()!;if(outcome instanceof Error)throw outcome;return outcome;});

  const result=await payout(group,42,5);

  assert.equal(result.ok,true);
  assert.equal(calls.length,5);
  assert.equal(calls[0]!.url,"https://auth.roblox.com/v2/logout");
  assert.equal(calls.filter(({url})=>url.includes("/authenticator/verify")).length,1);
  assert.deepEqual(calls[1]!.data,{PayoutType:"FixedAmount",Recipients:[{recipientId:42,recipientType:"User",amount:5}]});
  assert.equal((calls[3]!.data as Record<string,unknown>).challengeId,"outer-id");
  assert.equal((calls[3]!.data as Record<string,unknown>).challengeType,"twostepverification");
  const finalHeaders=calls[4]!.config!.headers as Record<string,string>;
  assert.equal(finalHeaders["rblx-challenge-id"],"outer-id");
  assert.equal(finalHeaders["rblx-challenge-type"],"twostepverification");
  assert.ok(finalHeaders["sec-ch-ua"]?.includes("Google Chrome"));
  assert.equal(finalHeaders["sec-fetch-mode"],"cors");
});

test("payout stops immediately when Roblox returns blocksession",async(t)=>{
  let calls=0;
  t.mock.method(axios,"post",async()=>{calls++;throw failure({},403,{"rblx-challenge-id":"blocked","rblx-challenge-type":"blocksession","retry-after":"120"});});

  const result=await payout({...group,cookie:"blocked-cookie"},42,5);

  assert.equal(result.ok,false);
  if(!result.ok)assert.equal(result.error.code,"ROBLOX_SESSION_BLOCKED");
});

test("payout caches the CSRF token using the legacy Axios behavior",async(t)=>{
  const seenTokens:string[]=[];
  const outcomes:Array<AxiosResponse|Error>=[failure({},403,{"x-csrf-token":"csrf-token"}),response({}),response({})];
  t.mock.method(axios,"post",async(_url,_data,config)=>{seenTokens.push(String((config?.headers as Record<string,string>)["X-CSRF-TOKEN"]??""));const outcome=outcomes.shift()!;if(outcome instanceof Error)throw outcome;return outcome;});

  const isolated={...group,cookie:"csrf-cache-cookie"};
  assert.equal((await payout(isolated,42,5)).ok,true);
  assert.equal((await payout(isolated,42,5)).ok,true);
  assert.deepEqual(seenTokens,["","csrf-token","csrf-token"]);
});

test("payout handles chef challenge properly without reinterpreting as 2FA",async(t)=>{
  t.mock.method(axios,"post",async()=>{throw failure({},403,{"rblx-challenge-id":"chef-id","rblx-challenge-type":"chef","rblx-challenge-metadata":"e30="});});

  const result=await payout({...group,cookie:"chef-cookie"},42,5);

  assert.equal(result.ok,false);
  if(!result.ok)assert.equal(result.error.code,"ROBLOX_CHALLENGE_CHEF");
});
