import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { classifiedGeminiPricePrompt, readClassifiedGeminiResult } from '../src/features/price-reader/classified-pricing.js';
import { countedGeminiPricePrompt } from '../src/features/price-reader/counted-contract.js';
import { readCountedGeminiResult } from '../src/features/price-reader/counted-pricing.js';
import { readGeminiImage } from '../src/features/price-reader/gemini-client.js';

const rules = JSON.parse(readFileSync(new URL('../../docs/examples/price-reader-count-prices.json', import.meta.url), 'utf8'));
const config = { PRICE_READER_PRICING_MODE: 'BOTH', PRICE_READER_LANGUAGE: 'TH', PRICE_READER_COUNT_PRICE_RULES: rules,
  PRICE_READER_PRICE_RULES: rules.filter((row: { itemCount: number }) => row.itemCount === 1) };
const mobile = { itemName: 'Venom (ไม่มีโลโก้)', currency: 'THB', itemType: 'SINGLE', itemCount: 1,
  standardPriceSatang: 38000, originalPriceSatang: 38000, nitroPriceSatang: 29500, discountPercent: null, ambiguous: false };

test('Backend and Runner prompts agree on icon-only Nitro comparisons, ordinary sales and uncertain reference prices', () => {
  const java = readFileSync(new URL('../../backend/src/main/java/com/fujipp/backend/store/PriceReaderGeminiClient.java', import.meta.url), 'utf8');
  const backend = java.match(/static final String CLASSIFIED_PROMPT = """([\s\S]*?)""";/)?.[1];
  assert.ok(backend);
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
  assert.equal(normalize(backend), normalize(classifiedGeminiPricePrompt));
  for (const prompt of [classifiedGeminiPricePrompt, countedGeminiPricePrompt]) {
    assert.match(prompt, /Nitro logo\/badge \(comet\/speed-wheel icon\)/);
    assert.match(prompt, /standardPriceSatang=38000, originalPriceSatang=38000 and nitroPriceSatang=29500/);
    assert.match(prompt, /Ordinary sale without a Nitro badge or label/);
    assert.match(prompt, /standardPriceSatang=29500, originalPriceSatang=38000 and nitroPriceSatang=null/);
    assert.match(prompt, /If its role as the payable non-Nitro price is unclear, keep standardPriceSatang=null/);
    assert.match(prompt, /Ignore the Shop-credit balance/);
  }
});

test('both Gemini clients send the corrected prompt and preserve separate 380/295 prices through quote matching', async t => {
  for (const mode of [true, 'COUNTED'] as const) {
    const { itemCount: _count, ...classified } = mobile;
    const expected = mode === 'COUNTED' ? mobile : classified;
    const mock = t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      assert.equal(request.systemInstruction.parts[0].text, mode === 'COUNTED' ? countedGeminiPricePrompt : classifiedGeminiPricePrompt);
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(expected) }] } }] });
    });
    try {
      const data = await readGeminiImage('AQ.synthetic-nitro-price-test-key', 'gemini-3.5-flash-lite', Buffer.from('image'), 'image/png', undefined, mode);
      assert.deepEqual(data, expected);
      const result = mode === 'COUNTED' ? readCountedGeminiResult(data, config) : readClassifiedGeminiResult(data, config);
      assert.equal(result.standard_price, '380.00');
      assert.equal(result.nitro_price, '295.00');
      assert.equal(result.standard_shop_price, '115.00');
      assert.equal(result.nitro_shop_price, '75.00');
    } finally { mock.mock.restore(); }
  }
});

test('ordinary sale and uncertain crossed-out evidence never become an invented Nitro or standard quote', () => {
  for (const language of ['TH', 'EN']) {
    const settings = { ...config, PRICE_READER_LANGUAGE: language };
    const sale = readCountedGeminiResult({ ...mobile, standardPriceSatang: 29500, nitroPriceSatang: null }, settings);
    assert.equal(sale.standard_shop_price, '75.00');
    assert.equal(sale.nitro_price, '');
    assert.equal(sale.nitro_shop_price, '');
    const uncertain = readCountedGeminiResult({ ...mobile, standardPriceSatang: null }, settings);
    assert.equal(uncertain.standard_price, '');
    assert.equal(uncertain.standard_shop_price, '');
    assert.equal(uncertain.nitro_shop_price, '75.00');
    const promotion = readCountedGeminiResult({ ...mobile, standardPriceSatang: 33900 }, settings);
    assert.equal(promotion.standard_shop_price, '90.00');
    assert.equal(promotion.nitro_shop_price, '75.00');
    const ambiguous = readCountedGeminiResult({ ...mobile, ambiguous: true }, settings);
    assert.equal(ambiguous.status, 'error');
    assert.equal(ambiguous.shop_price, undefined);
  }
});
