import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { setImmediate as settle } from "node:timers/promises";
import { promptPayQrImage } from "../src/features/wallet-topup/qr-image.js";
import { walletTopupFeatureV21 } from "../src/features/wallet-topup/index.js";
import { renderWalletPresentation } from "../src/features/wallet-topup/v1.0.0.js";
import type { FeatureContext,PromptPaySession } from "../src/types.js";

const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4z8AAAAASUVORK5CYII=","base64");
const session:PromptPaySession={sessionId:"qr-session",amountSatang:5000,currency:"THB",accountName:"Test shop",
  expiresAt:"2026-10-27T12:00:03Z",qrUrl:"https://promptpay.io/unavailable.png",qrImageDataUri:`data:image/png;base64,${png.toString("base64")}`};

test("uses generated PNG bytes instead of fetching the external QR URL",()=>{
  const result=promptPayQrImage(session);
  assert.equal(result.url,"attachment://promptpay-qr.png");
  assert.deepEqual(result.files,[{attachment:png,name:"promptpay-qr.png"}]);
});
test("keeps older Backend responses compatible during a rolling deployment",()=>{
  const {qrImageDataUri:_,...legacy}=session;
  assert.deepEqual(promptPayQrImage(legacy),{url:legacy.qrUrl,files:[]});
});
test("invalid generated images fail instead of silently returning to the external provider",()=>{
  for(const value of ["", "https://untrusted.invalid/image.png", "data:image/png;base64,aGVsbG8=", `data:image/png;base64,${"A".repeat(350_001)}`])
    assert.throws(()=>promptPayQrImage({...session,qrImageDataUri:value}));
});
for(const mode of ["EMBED","COMPONENTS_V2"]){
  test(`${mode} QR messages use the attached image URL`,()=>{
    const context={guildId:"111111111111111111",config:{SLIP_CHANNEL_ID:"333333333333333333"},
      presentations:{promptpay_qr:{mode,title:"PromptPay",description:"{{amount}}",image_url:"{{qr_url}}"}}} as unknown as FeatureContext;
    const payload=JSON.parse(JSON.stringify(renderWalletPresentation(context,"promptpay_qr",{qr_url:promptPayQrImage(session).url,amount:"50.00"},true)));
    const url=mode==="EMBED"?payload.embeds[0].image.url:payload.components[0].components[3].items[0].media.url;
    assert.equal(url,"attachment://promptpay-qr.png");
  });
}

test("uploads once and preserves the QR attachment during countdown edits",async(t)=>{
  t.mock.timers.enable({apis:["setInterval","Date"],now:Date.parse("2026-10-27T12:00:00Z")});
  const client=new EventEmitter(), replies:Record<string,any>[]=[],edits:Record<string,any>[]=[];
  const context={botId:"bot",installationId:"installation",guildId:"111111111111111111",client,config:{MIN_TOPUP_SATANG:1000},runtimeState:{},
    presentations:{promptpay_qr:{mode:"EMBED",title:"PromptPay",description:"{{remaining_time}}",image_url:"{{qr_url}}"},expired:{mode:"EMBED",title:"Expired"}},
    wallet:{createPromptPay:async()=>session},saveRuntimeState:async()=>{},reportFeatureError:async()=>{}} as unknown as FeatureContext;
  const interaction={isChatInputCommand:()=>false,isButton:()=>false,isModalSubmit:()=>true,isRepliable:()=>true,
    customId:"wallet:promptpay",user:{id:"222222222222222222"},guild:null,fields:{getTextInputValue:()=>"50.00"},
    reply:async(payload:Record<string,any>)=>{replies.push(payload);},editReply:async(payload:Record<string,any>)=>{edits.push(payload);}};
  const dispose=await walletTopupFeatureV21.activate(context);
  try {
    client.emit("interactionCreate",interaction);
    await settle();
    assert.equal(replies.length,1);
    assert.deepEqual(replies[0]?.files,[{attachment:png,name:"promptpay-qr.png"}]);
    assert.equal(replies[0]?.embeds[0].image.url,"attachment://promptpay-qr.png");
    t.mock.timers.tick(1000);
    await settle();
    assert.equal(edits.length,1);
    assert.equal(edits[0]?.embeds[0].image.url,"attachment://promptpay-qr.png");
    assert.equal("files" in edits[0]!,false);
    assert.equal("attachments" in edits[0]!,false);
    t.mock.timers.tick(2000);
    await settle();
    assert.equal(edits.at(-1)?.embeds[0].title,"Expired");
    assert.deepEqual(edits.at(-1)?.attachments,[]);
  } finally { await dispose(); }
});
