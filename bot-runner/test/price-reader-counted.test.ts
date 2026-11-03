import { countedGeminiPriceSchema } from '../src/features/price-reader/counted-contract.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { readCountedGeminiResult, parseCountedGeminiPrice, validCountedPriceRules } from '../src/features/price-reader/counted-pricing.js';
import { createCountChoices } from '../src/features/price-reader/counted-choices.js';
import { readGeminiImage } from '../src/features/price-reader/gemini-client.js';
import { getFeature } from '../src/feature-registry.js';
import type { FeatureContext } from '../src/types.js';

const rules: unknown = JSON.parse(readFileSync(new URL('../../docs/examples/price-reader-count-prices.json', import.meta.url), 'utf8'));
const base = { itemName: 'บันเดิล / Bundle', currency: 'THB', itemType: 'BUNDLE', itemCount: 2, standardPriceSatang: null, nitroPriceSatang: 47500, originalPriceSatang: null, discountPercent: null, ambiguous: false };
const config = { PRICE_READER_COUNT_PRICE_RULES: rules, PRICE_READER_PRICING_MODE: 'NITRO', PRICE_READER_LANGUAGE: 'TH' };

test('all 50 provided pairs match only their count and Nitro table in Thai and English', () => {
  assert.equal(validCountedPriceRules(rules), true);
  if (!validCountedPriceRules(rules)) throw new Error();
  assert.equal(rules.length, 50);
  assert.equal(new Set(rules.map(row => `${row.itemCount}/${row.pricingMode}`)).size, 10);
  for (const row of rules) for (const language of ['TH', 'EN']) {
    const result = readCountedGeminiResult({ ...base, itemType: row.itemType, itemCount: row.itemCount,
      standardPriceSatang: row.pricingMode === 'STANDARD' ? row.discordPriceSatang : null,
      nitroPriceSatang: row.pricingMode === 'NITRO' ? row.discordPriceSatang : null },
    { ...config, PRICE_READER_PRICING_MODE: row.pricingMode, PRICE_READER_LANGUAGE: language });
    assert.equal(result.shop_price, (row.shopPriceSatang / 100).toFixed(2));
    assert.equal(result.item_count, String(row.itemCount));
    assert.match(result.shop_price_text!, language === 'TH' ? /บาท/ : /THB/);
  }
  assert.equal(readCountedGeminiResult(base, config).shop_price, '100.00');
  assert.equal(readCountedGeminiResult({ ...base, itemCount: 3 }, config).shop_price, '140.00');
  assert.equal(readCountedGeminiResult({ ...base, itemType: 'SINGLE', itemCount: 1, nitroPriceSatang: 38000 }, config).shop_price, '115.00');
  assert.equal(readCountedGeminiResult({ ...base, nitroPriceSatang: 38000 }, config).shop_price, '100.00');
});
test('never guesses from price, crossed-out prices, tolerance, legacy rules or another category', () => {
  const pending = readCountedGeminiResult({ ...base, itemCount: null }, config);
  assert.ok(pending.pending_read); assert.equal(pending.shop_price, undefined);
  assert.equal(readCountedGeminiResult({ ...base, itemCount: null }, config, 3).shop_price, '140.00');
  for (const data of [{ ...base, itemCount: 6 }, { ...base, ambiguous: true, itemCount: null }, { ...base, currency: null, itemCount: null }, { ...base, nitroPriceSatang: null, originalPriceSatang: 47500 }]) {
    const result = readCountedGeminiResult(data, config);
    assert.equal(result.status, 'error'); assert.equal(result.pending_read, undefined);
  }
  assert.equal(readCountedGeminiResult(base, config, 3).status, 'error');
  assert.equal(readCountedGeminiResult({ ...base, itemCount: null }, config, 1).status, 'error');
  const empty = { ...config, PRICE_READER_COUNT_PRICE_RULES: [], PRICE_READER_MATCH_TOLERANCE_SATANG: 5000, PRICE_READER_PRICE_MAP: [{discordPrice:475,shopPrice:1}] };
  assert.equal(readCountedGeminiResult(base, empty).shop_price_found, 'false');
  assert.equal(readCountedGeminiResult({ ...base, nitroPriceSatang: 47600 }, { ...config, PRICE_READER_MATCH_TOLERANCE_SATANG: 5000 }).shop_price_found, 'false');
  const both = readCountedGeminiResult(base, { ...config, PRICE_READER_PRICING_MODE: 'BOTH', PRICE_READER_LANGUAGE: 'EN' });
  assert.equal(both.standard_shop_price_text, 'Not visible in image');
  assert.equal(both.nitro_shop_price_text, '100.00 THB');
});
test('rejects contradictory extraction and duplicate keys without rejecting different bundle counts', () => {
  for (const value of [{ ...base, itemCount: 1 }, { ...base, itemCount: 2.5 }, { ...base, itemCount: undefined }, { ...base, itemType:'SINGLE',itemCount:null }, { ...base,itemType:'UNKNOWN',itemCount:2 }]) assert.throws(() => parseCountedGeminiPrice(value), /GEMINI_INVALID_RESPONSE/);
  if (!validCountedPriceRules(rules)) throw new Error();
  assert.equal(validCountedPriceRules([...rules, rules[0]]),false);
  assert.equal(validCountedPriceRules([{...rules[0],itemCount:2}]),false);
  assert.equal(validCountedPriceRules([{...rules[0],shopPriceSatang:1.5}]),false);
});
test('Gemini count contract requests bilingual visible evidence and preserves old registered versions', async t => {
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.generationConfig.responseJsonSchema, countedGeminiPriceSchema);
    assert.match(body.systemInstruction.parts[0].text, /Thai and English/);
    assert.match(body.systemInstruction.parts[0].text, /preview tabs/);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(base)}]}}]});
  });
  assert.deepEqual(await readGeminiImage('AQ.synthetic-key-for-count-tests', 'gemini-3.5-flash-lite', Buffer.from('image'), 'image/png', undefined, 'COUNTED'), base);
  for (const version of ['1.0.0','2.0.0','3.0.0','3.1.0','3.2.0']) assert.equal(getFeature('price-reader',version)?.version,version);
});

function choiceFixture(language = 'EN') {
  const client = new EventEmitter();
  const edits: Record<string,unknown>[] = [], replies: Record<string,unknown>[] = [];
  const prompt = { id:'prompt', edit:async (payload:Record<string,unknown>)=>{edits.push(payload);} };
  const context = {client,installationId:'installation',config:{...config,PRICE_READER_LANGUAGE:language},presentations:{result:{mode:'EMBED',description:'{{results_text}}'}}, reportFeatureError:async()=>undefined} as unknown as FeatureContext;
  const choices = createCountChoices(context);
  const source = {author:{id:'owner'},channelId:'channel',guildId:'guild',reply:async(payload:Record<string,unknown>)=>{replies.push(payload);return prompt;}};
  const processing = {delete:async()=>undefined};
  const images = [{url:'https://cdn.discordapp.com/attachments/1/2/image.png'}];
  const pending = readCountedGeminiResult({...base,itemCount:null},context.config);
  const start = async (results=[pending]) => { await choices.handleResults(source as never,processing as never,results,Array.from({length:results.length},()=>images[0]!) as never); };
  const customId = () => ((replies[0]?.components ?? []) as Array<{components:Array<{custom_id:string}>}>)[0]!.components[0]!.custom_id;
  const interaction = (id:string,user='owner',count='3') => {const feedback:unknown[]=[];return {isStringSelectMenu:()=>true,isButton:()=>false,customId:id,user:{id:user},message:{id:'prompt'},channelId:'channel',guildId:'guild',values:[count],reply:async(payload:unknown)=>{feedback.push(payload);},deferUpdate:async()=>undefined,feedback};};
  const emit = async (value:ReturnType<typeof interaction>) => {client.emit('interactionCreate',value);await new Promise(resolve=>setImmediate(resolve));};
  return {start,choices,edits,replies,customId,interaction,emit,client};
}
test('only sender can choose, prices resolve locally without another Gemini request, and stale clicks cannot affect the next image', async () => {
  const f=choiceFixture();
  try {
    const result=readCountedGeminiResult({...base,itemCount:null},config);
    await f.start([result,{...result}]);
    const id=f.customId();
    const stranger=f.interaction(id,'stranger');await f.emit(stranger);
    assert.equal(stranger.feedback.length,1);assert.equal(f.edits.length,0);
    await f.emit(f.interaction(id));
    assert.equal(f.edits.length,1);
    await f.emit(f.interaction(id)); // previous image's late click
    assert.equal(f.edits.length,1);
    const next=((f.edits[0]!.components as Array<{components:Array<{custom_id:string}>}>)[0]!.components[0]!.custom_id);
    await f.emit(f.interaction(next,'owner','2'));
    const final=JSON.stringify(f.edits.at(-1));
    assert.match(final,/140.00 THB/);assert.match(final,/100.00 THB/);
    assert.doesNotMatch(final,/pending_read|custom_id/);
    assert.deepEqual(f.edits.at(-1)?.allowedMentions,{parse:[]});
  } finally {await f.choices.stop();}
  assert.equal(f.client.listenerCount('interactionCreate'),0);
});
test('expired and cancelled choices cannot produce a quote and cleanup removes controls', async t => {
  const f=choiceFixture('TH');
  try {
    await f.start();const id=f.customId();
    const clock=t.mock.method(Date,'now',()=>Number.MAX_SAFE_INTEGER);
    const expired=f.interaction(id);await f.emit(expired);assert.equal(expired.feedback.length,1);assert.equal(f.edits.length,0);
    clock.mock.restore();
    const cancel={...f.interaction(id.replace(/:count:0$/,':cancel')),isStringSelectMenu:()=>false,isButton:()=>true};
    await f.emit(cancel);
    assert.deepEqual(f.edits.at(-1)?.components,[]);
    const late=f.interaction(id);await f.emit(late);assert.equal(late.feedback.length,1);
  } finally {await f.choices.stop();}
});

test('3.2 Discord image pipeline asks in English and edits its own V2 result after local confirmation', async t => {
  const { default: sharp } = await import('sharp');
  const png = await sharp({create:{width:20,height:20,channels:3,background:'white'}}).png().toBuffer();
  const client = new EventEmitter(); let googleCalls=0, replies=0, deleted=0;
  t.mock.method(globalThis,'fetch',async(url:unknown)=>{
    if(String(url).startsWith('https://cdn.discordapp.com/'))return new Response(png,{headers:{'content-type':'image/png'}});
    googleCalls++;return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({...base,itemCount:null})}]}}]});
  });
  let gotPrompt!:(value:Record<string,unknown>)=>void,gotFinal!:(value:Record<string,unknown>)=>void;
  const promptReady=new Promise<Record<string,unknown>>(resolve=>{gotPrompt=resolve;});
  const finalReady=new Promise<Record<string,unknown>>(resolve=>{gotFinal=resolve;});
  const prompt={id:'confirmation',edit:async(payload:Record<string,unknown>)=>{gotFinal(payload);}};
  const context={client,botId:'bot',installationId:'installation',guildId:'guild',config:{...config,PRICE_READER_LANGUAGE:'EN',PRICE_READER_CHANNEL_ID:'123456789012345678',PRICE_READER_RESULTS_ITEM_TEMPLATE:'{{item_type}} | {{shop_price_text}}'},secrets:{GEMINI_API_KEY:'AQ.synthetic-key-for-count-tests'},presentations:{result:{mode:'COMPONENTS_V2',components:[{type:17,components:[{type:10,content:'{{results_text}}'}]}]}},reportFeatureError:async()=>assert.fail('Unexpected feature error')} as unknown as FeatureContext;
  const stop=await getFeature('price-reader','3.2.0')!.activate(context);
  try {
    client.emit('messageCreate',{id:'source',author:{bot:false,id:'owner'},channelId:'123456789012345678',guildId:'guild',attachments:new Map([['one',{id:'one',url:'https://cdn.discordapp.com/attachments/1/2/image.png',contentType:'image/png'}]]),reply:async(payload:Record<string,unknown>)=>{
      replies++;if(replies===1)return {flags:{has:()=>true},delete:async()=>{deleted++;},edit:async()=>assert.fail('Unresolved image must not be quoted')};gotPrompt(payload);return prompt;
    }});
    const payload=await promptReady;
    assert.match(JSON.stringify(payload),/how many included items/);
    await new Promise(resolve=>setImmediate(resolve));
    const id=(payload.components as Array<{components:Array<{custom_id:string}>}>)[0]!.components[0]!.custom_id;
    client.emit('interactionCreate',{isStringSelectMenu:()=>true,isButton:()=>false,customId:id,user:{id:'owner'},message:{id:'confirmation'},channelId:'123456789012345678',guildId:'guild',values:['2'],deferUpdate:async()=>undefined,reply:async()=>assert.fail('Unexpected rejection')});
    const final=await finalReady;
    assert.match(JSON.stringify(final),/Bundle · 2 items.*100.00 THB/);
    assert.equal(googleCalls,1);assert.equal(deleted,1);assert.deepEqual(final.allowedMentions,{parse:[]});
    assert.equal(final.flags,32768);assert.deepEqual(final.embeds,[]);
  } finally {await stop();}
  assert.equal(client.listenerCount('messageCreate'),0);assert.equal(client.listenerCount('interactionCreate'),0);
});
