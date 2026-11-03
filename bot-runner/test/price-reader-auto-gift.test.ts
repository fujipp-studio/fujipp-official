import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import sharp from 'sharp';
import { readCountedGeminiResult, validCountedPriceRules } from '../src/features/price-reader/counted-pricing.js';
import { getFeature } from '../src/feature-registry.js';
import type { FeatureContext } from '../src/types.js';
const rules = [
  { itemType:'SINGLE', itemCount:1, pricingMode:'NITRO', discordPriceSatang:29500, shopPriceSatang:7500, giftPriceSatang:10000 },
  { itemType:'SINGLE', itemCount:1, pricingMode:'STANDARD', discordPriceSatang:38000, shopPriceSatang:11500, giftPriceSatang:15000 },
  { itemType:'BUNDLE', itemCount:2, pricingMode:'NITRO', discordPriceSatang:29500, shopPriceSatang:9000, giftPriceSatang:16000 },
];
const image = { itemName:'Item', currency:'THB', itemType:'SINGLE', itemCount:1, standardPriceSatang:38000, nitroPriceSatang:29500, originalPriceSatang:38000, discountPercent:null, ambiguous:false };
const config = { PRICE_READER_LANGUAGE:'EN', PRICE_READER_COUNT_PRICE_RULES:rules, PRICE_READER_PRICING_MODE:'AUTO', PRICE_READER_OFFER_MODE:'BOTH' };

test('AUTO selects a visible Nitro amount, otherwise standard, independently of the requested offer display', () => {
  for (const mode of ['SHOP','GIFT','BOTH']) {
    const nitro=readCountedGeminiResult(image,{...config,PRICE_READER_OFFER_MODE:mode});
    assert.equal(nitro.pricing_selection_key,'AUTO');assert.equal(nitro.pricing_mode_key,'NITRO');
    assert.equal(nitro.discord_price,'295.00');assert.equal(nitro.shop_price,'75.00');assert.equal(nitro.gift_price,'100.00');
    assert.equal(nitro.shop_price_text,mode==='SHOP'?'75.00 THB':mode==='GIFT'?'100.00 THB':'Shop price: 75.00 THB / 🎁 Gift price: 100.00 THB');
    const standard=readCountedGeminiResult({...image,nitroPriceSatang:null},{...config,PRICE_READER_OFFER_MODE:mode});
    assert.equal(standard.pricing_mode_key,'STANDARD');assert.equal(standard.discord_price,'380.00');assert.equal(standard.gift_price,'150.00');
  }
});
test('Gift quotes never borrow another count, tier, shop price, or crossed-out reference', () => {
  const absent={...config,PRICE_READER_OFFER_MODE:'GIFT',PRICE_READER_COUNT_PRICE_RULES:rules.map((row,index)=>index===0?{...row,giftPriceSatang:null}:row)};
  const result=readCountedGeminiResult(image,absent);
  assert.equal(result.gift_price,'');assert.equal(result.shop_price_text,'Ask for Gift price');assert.equal(result.offer_price_found,'false');
  assert.equal(result.shop_price,'75.00');assert.equal(result.pricing_mode_key,'NITRO');
  const bundle=readCountedGeminiResult({...image,itemType:'BUNDLE',itemCount:2},config);
  assert.equal(bundle.gift_price,'160.00');
  assert.equal(readCountedGeminiResult({...image,itemType:'UNKNOWN',itemCount:null},config,2).gift_price,'160.00');
  for (const partial of [{ambiguous:true},{currency:null},{standardPriceSatang:null,nitroPriceSatang:null}])
    assert.equal(readCountedGeminiResult({...image,...partial},config).status,'error');
  const higher=readCountedGeminiResult({...image,nitroPriceSatang:40000},config);
  assert.equal(higher.discord_price,'400.00');assert.equal(higher.pricing_mode_key,'NITRO');assert.equal(higher.gift_price_found,'false');
});
test('optional Gift fields preserve old rules and zero prices while rejecting malformed values', () => {
  const {giftPriceSatang:_gift,...old}=rules[0]!;
  assert.equal(validCountedPriceRules([old]),true);
  for (const giftPriceSatang of [null,0,100000000]) assert.equal(validCountedPriceRules([{...old,giftPriceSatang}]),true);
  for (const giftPriceSatang of [-1,1.5,100000001,'10000',true]) assert.equal(validCountedPriceRules([{...old,giftPriceSatang}]),false);
  const zero=readCountedGeminiResult(image,{...config,PRICE_READER_OFFER_MODE:'GIFT',PRICE_READER_COUNT_PRICE_RULES:[{...old,giftPriceSatang:0}]});
  assert.equal(zero.shop_price_text,'0.00 THB');assert.equal(zero.offer_price_found,'true');
});
test('Both tiers, custom Gift wording and shop/gift separation work in Thai and English', () => {
  for (const language of ['TH','EN']) {
    const both=readCountedGeminiResult(image,{...config,PRICE_READER_LANGUAGE:language,PRICE_READER_PRICING_MODE:'BOTH'});
    assert.equal(both.gift_price,'');assert.equal(both.gift_price_found,'true');
    assert.equal(both.standard_gift_price,'150.00');assert.equal(both.nitro_gift_price,'100.00');
    assert.match(both.shop_price_text!,/150.00/);assert.match(both.shop_price_text!,/100.00/);
    const custom=readCountedGeminiResult(image,{...config,PRICE_READER_LANGUAGE:language,PRICE_READER_GIFT_UNAVAILABLE_TEXT:'ASK',PRICE_READER_OFFER_TEMPLATE:'Gift {{gift_price}} / Shop {{shop_offer_text}}'});
    assert.match(custom.shop_price_text!,/^Gift 100.00 \/ Shop 75.00/);
    assert.equal(custom.shop_price_label,language==='TH'?'ราคาที่ร้านเสนอ':'Quoted prices');
  }
});
test('a third-image Gemini failure retains the first two AUTO/Gift quotes without retrying or failing the feature', async t => {
  const png=await sharp({create:{width:20,height:20,channels:3,background:'white'}}).png().toBuffer();
  const client=new EventEmitter();let calls=0;
  t.mock.method(globalThis,'fetch',async(url:unknown)=>{
    if(String(url).startsWith('https://cdn.discordapp.com/')) return new Response(png,{headers:{'content-type':'image/png'}});
    if(++calls===3) return new Response('unavailable',{status:503});
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(image)}]}}]});
  });
  let complete!:(value:Record<string,unknown>)=>void;
  const finished=new Promise<Record<string,unknown>>(resolve=>{complete=resolve});
  const reports:unknown[][]=[];
  const context={client,botId:'bot',installationId:'installation',guildId:'guild',config:{...config,PRICE_READER_CHANNEL_ID:'123456789012345678',PRICE_READER_RESULTS_ITEM_TEMPLATE:'{{result_index}} {{discord_price}} {{shop_price_text}}'},secrets:{GEMINI_API_KEY:'AQ.synthetic-auto-gift-test-key'},presentations:{},reportFeatureError:async(...args:unknown[])=>{reports.push(args)}} as unknown as FeatureContext;
  const stop=await getFeature('price-reader','3.2.0')!.activate(context);
  try {
    client.emit('messageCreate',{id:'source',author:{bot:false,id:'owner'},channelId:'123456789012345678',guildId:'guild',attachments:new Map(['1','2','3'].map(id=>[id,{id,url:`https://cdn.discordapp.com/attachments/1/${id}/image.png`,contentType:'image/png'}])),reply:async()=>({flags:{has:()=>false},edit:async(payload:Record<string,unknown>)=>{complete(payload)}})});
    const payload=await finished;
    assert.equal(calls,3);assert.deepEqual(payload.allowedMentions,{parse:[]});
    const rendered=JSON.stringify(payload);
    assert.equal((rendered.match(/Gift price: 100.00/g)??[]).length,2);
    assert.match(rendered,/temporarily unavailable/);
    assert.equal(reports.length,1);assert.deepEqual(reports[0]![2],{recoverable:true});
  } finally {await stop()}
});
