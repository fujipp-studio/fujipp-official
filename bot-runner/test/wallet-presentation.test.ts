import assert from "node:assert/strict";
import test from "node:test";
import { renderWalletPresentation } from "../src/features/wallet-topup/v1.0.0.js";
import type { FeatureContext } from "../src/types.js";

const qr="https://example.com/payment.png",channel="https://discord.com/channels/111111111111111111/222222222222222222";
function render(definition:Record<string,unknown>) {
  const context={guildId:"111111111111111111",config:{SLIP_CHANNEL_ID:"222222222222222222"},presentations:{promptpay_qr:definition}} as unknown as FeatureContext;
  return JSON.parse(JSON.stringify(renderWalletPresentation(context,"promptpay_qr",{qr_url:qr},true)));
}
test("flat and nested Embed image objects display QR while channel links retain their destination",()=>{
  for (const definition of [
    {mode:"EMBED",image:{url:"{{slip_channel_url}}"},links:[{url:"{{slip_channel_url}}"}]},
    {mode:"EMBED",embed:{image:{url:"{{qr_url}}"},links:[{url:"{{slip_channel_url}}"}]}},
  ]) {
    const payload=render(definition);
    assert.equal(payload.embeds[0].image.url,qr);
    assert.equal(payload.components[0].components[0].url,channel);
  }
});
test("advanced Embed arrays repair the channel variable only in image positions",()=>{
  const payload=render({mode:"EMBED",embeds:[{image:{url:"{{slip_channel_url}}"},description:"{{slip_channel_url}}"}],
    components:[{type:1,components:[{type:2,style:5,url:"{{slip_channel_url}}",label:"ส่งสลิป"}]}]});
  assert.equal(payload.embeds[0].image.url,qr);
  assert.equal(payload.embeds[0].description,channel);
  assert.equal(payload.components[0].components[0].url,channel);
});
test("Components V2 media displays QR and link buttons open the slip channel",()=>{
  const payload=render({mode:"COMPONENTS_V2",components:[{type:17,components:[
    {type:12,items:[{media:{url:"{{slip_channel_url}}"}}]},
    {type:1,components:[{type:2,style:5,url:"{{slip_channel_url}}",label:"ส่งสลิป"}]},
  ]}]});
  assert.equal(payload.components[0].components[0].items[0].media.url,qr);
  assert.equal(payload.components[0].components[1].components[0].url,channel);
});
