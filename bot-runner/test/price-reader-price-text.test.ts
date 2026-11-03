import test from 'node:test';
import assert from 'node:assert/strict';
import { readCountedGeminiResult } from '../src/features/price-reader/counted-pricing.js';
import { buildResultValues } from '../src/features/price-reader/result-presentation.js';
import { localizedCountedConfig } from '../src/features/price-reader/counted-text.js';

const image = { itemName:'Item',currency:'THB',itemType:'SINGLE',itemCount:1,standardPriceSatang:38000,nitroPriceSatang:29500,originalPriceSatang:null,discountPercent:null,ambiguous:false };
const config = { PRICE_READER_PRICING_MODE:'BOTH',PRICE_READER_COUNT_PRICE_RULES:[
  { itemType:'SINGLE',itemCount:1,pricingMode:'STANDARD',discordPriceSatang:38000,shopPriceSatang:11500 },
  { itemType:'SINGLE',itemCount:1,pricingMode:'NITRO',discordPriceSatang:29500,shopPriceSatang:7500 },
] };

test('automatic price text preserves previous Both output in each language without new saved fields', () => {
  for (const language of ['TH','EN']) {
    const result = readCountedGeminiResult(image,{...config,PRICE_READER_LANGUAGE:language});
    assert.equal(result.discord_price,language==='EN'?'Without Nitro: 380.00 / With Nitro: 295.00':'ไม่มี Nitro: 380.00 / มี Nitro: 295.00');
    assert.equal(result.shop_price_text,language==='EN'?'Without Nitro: 115.00 THB / With Nitro: 75.00 THB':'ไม่มี Nitro: 115.00 บาท / มี Nitro: 75.00 บาท');
  }
});
test('custom labels, order, Markdown, newlines and currency affect presentation while numeric quotes stay unchanged', () => {
  const custom = {...config,PRICE_READER_BOTH_DISCORD_TEMPLATE:'💎 **VIP** {{nitro_price_text}}\n👤 Regular {{standard_price_text}}',
    PRICE_READER_BOTH_SHOP_TEMPLATE:'VIP ฿{{nitro_shop_amount_text}}\nRegular ฿{{standard_shop_amount_text}}',
    PRICE_READER_RESULTS_ITEM_TEMPLATE:'{{discord_price}}\n{{shop_price_text}}'};
  const result=readCountedGeminiResult(image,custom);
  assert.equal(result.discord_price,'💎 **VIP** 295.00\n👤 Regular 380.00');
  assert.equal(result.shop_price_text,'VIP ฿75.00\nRegular ฿115.00');
  assert.equal(result.standard_price,'380.00');assert.equal(result.nitro_price,'295.00');
  assert.equal(result.standard_shop_price,'115.00');assert.equal(result.nitro_shop_price,'75.00');
  assert.equal(result.shop_price_found,'true');
  assert.equal(buildResultValues([result],custom,'3.2.0').results_text,result.discord_price+'\n'+result.shop_price_text);
});
test('missing image price and unmatched shop price stay distinct with custom text, including zero shop prices', () => {
  const custom={...config,PRICE_READER_MISSING_PRICE_TEXT:'Ask for screenshot',PRICE_READER_UNMATCHED_PRICE_TEXT:'No shop rule at {{discord_price}}',
    PRICE_READER_BOTH_DISCORD_TEMPLATE:'{{standard_price_text}} | {{nitro_price_text}}',
    PRICE_READER_BOTH_SHOP_TEMPLATE:'{{standard_shop_amount_text}} | {{nitro_shop_amount_text}}'};
  const partial=readCountedGeminiResult({...image,nitroPriceSatang:null},custom);
  assert.equal(partial.discord_price,'380.00 | Ask for screenshot');
  assert.equal(partial.shop_price_text,'115.00 | Ask for screenshot');
  assert.equal(partial.nitro_price,'');assert.equal(partial.nitro_shop_price,'');
  const unmatched=readCountedGeminiResult({...image,nitroPriceSatang:20900},custom);
  assert.equal(unmatched.shop_price_text,'115.00 | No shop rule at 209.00');
  assert.equal(unmatched.shop_price_found,'false');
  const zero=readCountedGeminiResult(image,{...custom,PRICE_READER_COUNT_PRICE_RULES:config.PRICE_READER_COUNT_PRICE_RULES.map(row=>({...row,shopPriceSatang:0}))});
  assert.equal(zero.shop_price_text,'0.00 | 0.00');assert.equal(zero.shop_price_found,'true');
});
test('custom formats survive language changes; automatic reset follows language and single-tier modes keep their quotes', () => {
  const custom={...config,PRICE_READER_LANGUAGE:'EN',PRICE_READER_BOTH_DISCORD_TEMPLATE:'VIP {{nitro_price_text}}',PRICE_READER_MISSING_PRICE_TEXT:'Ask'};
  assert.equal(readCountedGeminiResult({...image,nitroPriceSatang:null},custom).discord_price,'VIP Ask');
  assert.equal(readCountedGeminiResult({...image,nitroPriceSatang:null},{...custom,PRICE_READER_LANGUAGE:'TH'}).discord_price,'VIP Ask');
  assert.equal(localizedCountedConfig({...custom,PRICE_READER_BOTH_DISCORD_TEMPLATE:'{{default}}'}).PRICE_READER_MISSING_PRICE_TEXT,'Ask');
  const auto=readCountedGeminiResult({...image,nitroPriceSatang:null},{...custom,PRICE_READER_BOTH_DISCORD_TEMPLATE:'{{default}}',PRICE_READER_MISSING_PRICE_TEXT:'{{default}}'});
  assert.equal(auto.discord_price,'Without Nitro: 380.00 / With Nitro: Not visible in image');
  for (const mode of ['STANDARD','NITRO']) {
    const result=readCountedGeminiResult(image,{...custom,PRICE_READER_PRICING_MODE:mode});
    assert.equal(result.discord_price,mode==='NITRO'?'295.00':'380.00');
    assert.equal(result.shop_price,mode==='NITRO'?'75.00':'115.00');
  }
});
