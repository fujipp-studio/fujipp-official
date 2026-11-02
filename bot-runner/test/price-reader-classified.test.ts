import assert from 'node:assert/strict';
import test from 'node:test';
import { readClassifiedGeminiResult, validPriceRules, parseClassifiedGeminiPrice, classifiedGeminiPriceSchema } from '../src/features/price-reader/classified-pricing.js';
import { readGeminiImage } from '../src/features/price-reader/gemini-client.js';
import { getFeature } from '../src/feature-registry.js';
import { buildResultValues } from '../src/features/price-reader/results.js';
const image = { itemType: 'SINGLE', itemName: 'Shop item', currency: 'THB', standardPriceSatang: 25000,
  nitroPriceSatang: 20900, originalPriceSatang: 29500, discountPercent: 15, ambiguous: false };
const rules = [
  { itemType: 'SINGLE', pricingMode: 'STANDARD', discordPriceSatang: 25000, shopPriceSatang: 5500 },
  { itemType: 'BUNDLE', pricingMode: 'STANDARD', discordPriceSatang: 25000, shopPriceSatang: 8000 },
  { itemType: 'SINGLE', pricingMode: 'NITRO', discordPriceSatang: 20900, shopPriceSatang: 4500 },
  { itemType: 'BUNDLE', pricingMode: 'NITRO', discordPriceSatang: 20900, shopPriceSatang: 7000 },
];
const config = { PRICE_READER_PRICING_MODE: 'STANDARD', PRICE_READER_PRICE_RULES: rules, PRICE_READER_MATCH_TOLERANCE_SATANG: 0 };
test('equal Discord prices choose different single/bundle and Nitro/standard shop prices', () => {
  assert.equal(validPriceRules(rules), true);
  for (const [type, mode, amount, discord] of [['SINGLE','STANDARD','55.00','250.00'],['BUNDLE','STANDARD','80.00','250.00'],['SINGLE','NITRO','45.00','209.00'],['BUNDLE','NITRO','70.00','209.00']]) {
    const result = readClassifiedGeminiResult({ ...image, itemType: type }, { ...config, PRICE_READER_PRICING_MODE: mode });
    assert.equal(result.shop_price, amount);
    assert.equal(result.discord_price, discord);
    assert.equal(result.standard_price, '250.00');
    assert.equal(result.nitro_price, '209.00');
  }
});
test('unknown type, missing selected price, malformed rules and ambiguity fail without substituting a price', () => {
  for (const data of [{ itemType: 'UNKNOWN' }, { standardPriceSatang: null }, { ambiguous: true }, { currency: null }])
    assert.equal(readClassifiedGeminiResult({ ...image, ...data }, config).status, 'error');
  assert.equal(readClassifiedGeminiResult({ ...image, nitroPriceSatang: null }, { ...config, PRICE_READER_PRICING_MODE: 'NITRO' }).status, 'error');
  assert.equal(readClassifiedGeminiResult(image, { ...config, PRICE_READER_PRICE_RULES: [{ discordPriceSatang:25000, shopPriceSatang:1 }] }).status,'error');
  assert.throws(() => parseClassifiedGeminiPrice({ ...image, itemType: 'inferred' }), /GEMINI_INVALID_RESPONSE/);
});
test('missing category and out-of-tolerance prices never reuse another category or legacy table', () => {
  const partial = { ...config, PRICE_READER_PRICE_RULES: [rules[0]], PRICE_READER_PRICE_MAP: [{ discordPrice:250,shopPrice:1 }] };
  assert.equal(readClassifiedGeminiResult({ ...image, itemType:'BUNDLE' },partial).shop_price_found,'false');
  assert.equal(readClassifiedGeminiResult({ ...image, standardPriceSatang:25100 },partial).shop_price_found,'false');
  assert.equal(readClassifiedGeminiResult({ ...image, standardPriceSatang:25100 },{ ...partial,PRICE_READER_MATCH_TOLERANCE_SATANG:100 }).shop_price,'55.00');
});
test('both mode quotes each tier independently within the detected category and counts one image', () => {
  const both = { ...config, PRICE_READER_PRICING_MODE: 'BOTH' };
  for (const [itemType, standard, nitro] of [['SINGLE','55.00','45.00'],['BUNDLE','80.00','70.00']]) {
    const result = readClassifiedGeminiResult({ ...image, itemType }, both);
    assert.equal(result.status, 'success');
    assert.equal(result.standard_price, '250.00');
    assert.equal(result.nitro_price, '209.00');
    assert.equal(result.standard_shop_price, standard);
    assert.equal(result.nitro_shop_price, nitro);
    assert.equal(result.shop_price, '');
    assert.equal(result.shop_price_found, 'true');
    assert.equal(result.shop_price_text, `ไม่มี Nitro: ${standard} บาท / มี Nitro: ${nitro} บาท`);
    const values = buildResultValues([result], both, '3.1.0');
    assert.equal(values.image_count, '1');
    assert.equal(values.success_count, '1');
    assert.match(values.results_text, /250.00.*209.00/);
    assert.ok(values.results_text.includes(result.shop_price_text));
  }
});
test('both mode distinguishes an absent image price from an unmatched table without substituting tiers', () => {
  const both = { ...config, PRICE_READER_PRICING_MODE: 'BOTH', PRICE_READER_MATCH_TOLERANCE_SATANG: 0 };
  const noNitro = readClassifiedGeminiResult({ ...image, nitroPriceSatang: null }, both);
  assert.equal(noNitro.standard_shop_price, '55.00');
  assert.equal(noNitro.nitro_price, '');
  assert.equal(noNitro.nitro_shop_price_text, 'ไม่พบราคาในรูป');
  const onlyNitro = readClassifiedGeminiResult({ ...image, standardPriceSatang: null }, both);
  assert.equal(onlyNitro.status, 'success');
  assert.equal(onlyNitro.standard_shop_price_text, 'ไม่พบราคาในรูป');
  assert.equal(onlyNitro.nitro_shop_price, '45.00');
  const unmatched = readClassifiedGeminiResult(image, { ...both, PRICE_READER_PRICE_RULES: [rules[0]],
    PRICE_READER_PRICE_MAP: [{discordPrice: 209, shopPrice: 1}] });
  assert.equal(unmatched.standard_shop_price, '55.00');
  assert.equal(unmatched.nitro_shop_price, '');
  assert.equal(unmatched.nitro_shop_price_text, 'ไม่พบราคาที่ตรงกัน');
  assert.equal(unmatched.shop_price_found, 'false');
  for (const patch of [{standardPriceSatang:null,nitroPriceSatang:null},{itemType:'UNKNOWN'},{ambiguous:true},{currency:null}])
    assert.equal(readClassifiedGeminiResult({...image,...patch},both).status,'error');
  assert.equal(validPriceRules([{...rules[0],pricingMode:'BOTH'}]),false);
  const free = readClassifiedGeminiResult(image, {...both,PRICE_READER_PRICE_RULES:[{...rules[0],shopPriceSatang:0},rules[2]]});
  assert.equal(free.standard_shop_price, '0.00');
});
test('duplicate prices are scoped to category and mode; fractional or negative satang are rejected', () => {
  assert.equal(validPriceRules([...rules, { ...rules[0] }]),false);
  for (const edit of [{shopPriceSatang:-1},{shopPriceSatang:1.5},{discordPriceSatang:'25000'},{itemType:'UNKNOWN'}])
    assert.equal(validPriceRules([{ ...rules[0],...edit }]),false);
  assert.equal(validPriceRules([{ ...rules[0],shopPriceSatang:0 }]),true);
});
test('classified API request explains bundle components and requires typed JSON while keeping 3.0 bundled', async t => {
  t.mock.method(globalThis,'fetch',async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    assert.deepEqual(body.generationConfig.responseJsonSchema,classifiedGeminiPriceSchema);
    assert.match(body.systemInstruction.parts[0].text,/Bundle components are one listing/);
    return Response.json({ candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(image)}]}}] });
  });
  const result = await readGeminiImage('AQ.synthetic-gemini.key-for-tests','gemini-3.5-flash-lite',Buffer.from('image'),'image/png',undefined,true);
  assert.equal((result as unknown as {itemType:string}).itemType,'SINGLE');
  assert.equal(getFeature('price-reader','3.0.0')?.version,'3.0.0');
  assert.equal(getFeature('price-reader','3.1.0')?.version,'3.1.0');
});

for (const mode of ['NITRO', 'BOTH']) test(`3.1 Discord pipeline renders ${mode} bundle quotes using one Gemini request`, async t => {
  const { EventEmitter } = await import('node:events');
  const { default: sharp } = await import('sharp');
  const client = new EventEmitter();
  const png = await sharp({ create: { width:20,height:20,channels:3,background:'white' } }).png().toBuffer();
  let calls = 0;
  t.mock.method(globalThis,'fetch',async (url: unknown, init?: RequestInit) => {
    if (String(url).startsWith('https://cdn.discordapp.com/')) return new Response(png,{headers:{'content-type':'image/png'}});
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.generationConfig.responseJsonSchema,classifiedGeminiPriceSchema);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({...image,itemType:'BUNDLE'})}]}}]});
  });
  let finish!: (payload: Record<string,unknown>) => void;
  const result = new Promise<Record<string,unknown>>(resolve=>{finish=resolve});
  const context = {client,botId:'bot',guildId:'guild',config:{...config,PRICE_READER_PRICING_MODE:mode,PRICE_READER_CHANNEL_ID:'123456789012345678'},
    secrets:{GEMINI_API_KEY:'AQ.synthetic-gemini.key-for-tests'},presentations:{result:{mode:'EMBED',description:'{{item_type}}|{{pricing_mode}}|{{discord_price}}|{{shop_price_text}}'}},
    reportFeatureError:async()=>{assert.fail('Unexpected feature error')}} as unknown as import('../src/types.js').FeatureContext;
  const stop = await getFeature('price-reader','3.1.0')!.activate(context);
  client.emit('messageCreate',{author:{bot:false},channelId:'123456789012345678',attachments:new Map([['1',{id:'1',url:'https://cdn.discordapp.com/attachments/1/2/image.png',contentType:'image/png'}]]),
    reply:async()=>({flags:{has:()=>false},edit:async(payload:Record<string,unknown>)=>finish(payload)})});
  const payload = await result;
  await stop();
  assert.equal(calls, 1);
  assert.equal((payload.embeds as Array<{description:string}>)[0]?.description, mode === 'NITRO'
    ? 'บันเดิล|มี Nitro|209.00|70.00 บาท'
    : 'บันเดิล|ไม่มี Nitro / มี Nitro|ไม่มี Nitro: 250.00 / มี Nitro: 209.00|ไม่มี Nitro: 80.00 บาท / มี Nitro: 70.00 บาท');
  assert.deepEqual(payload.allowedMentions,{parse:[]});
  assert.equal(client.listenerCount('messageCreate'),0);
});
