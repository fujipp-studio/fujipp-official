import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { readGeminiImage, GeminiReadError } from '../src/features/price-reader/gemini-client.js';
import { parseGeminiPrice, defaultGeminiModel, geminiPriceSchema } from '../src/features/price-reader/gemini-contract.js';
import { readGeminiResult } from '../src/features/price-reader/results.js';
import { getFeature } from '../src/feature-registry.js';
import type { FeatureContext } from '../src/types.js';

const key = 'AQ.synthetic-gemini.key-for-tests';
const price = { itemName: 'ดาวโปรยปราย', currency: 'THB', standardPriceSatang: 25000,
  originalPriceSatang: 29500, nitroPriceSatang: 20900, discountPercent: 15, ambiguous: false };
const config = { PRICE_READER_PRICE_MAP: [{ discordPrice: 250, shopPrice: 55 }], PRICE_READER_MATCH_TOLERANCE_SATANG: 0 };
function response(value: unknown = price) {
  return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
}

test('dashboard gateway and Runner share the Gemini extraction schema', () => {
  const java = readFileSync(new URL('../../backend/src/main/java/com/fujipp/backend/store/PriceReaderGeminiClient.java', import.meta.url), 'utf8');
  const schema = java.match(/static final String SCHEMA = """([\s\S]*?)""";/)?.[1];
  assert.ok(schema);
  assert.deepEqual(JSON.parse(schema), geminiPriceSchema);
});

test('Gemini prices use the standard price and never fall back to Nitro, another currency or ambiguous evidence', () => {
  assert.equal(readGeminiResult(price, config).shop_price, '55.00');
  assert.equal(readGeminiResult(price, config).discord_price, '250.00');
  for (const partial of [{ standardPriceSatang: null }, { currency: null }, { ambiguous: true }])
    assert.equal(readGeminiResult({ ...price, ...partial }, config).status, 'error');
  assert.equal(readGeminiResult({ ...price, standardPriceSatang: 25100 }, config).shop_price_found, 'false');
  for (const partial of [{ standardPriceSatang: 2.5 }, { standardPriceSatang: -1 }, { standardPriceSatang: '25000' },
    { standardPriceSatang: Number.MAX_SAFE_INTEGER }, { currency: 'USD' }, { ambiguous: undefined }, { discountPercent: 100 }])
    assert.throws(() => parseGeminiPrice({ ...price, ...partial }), /GEMINI_INVALID_RESPONSE/);
});

test('Gemini client sends inline images and schema only to Google with the key in a header', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls++;
    assert.equal(url, `https://generativelanguage.googleapis.com/v1beta/models/${defaultGeminiModel}:generateContent`);
    assert.equal(url.includes(key), false);
    assert.equal(new Headers(init.headers).get('x-goog-api-key'), key);
    assert.equal(init.redirect, 'error');
    const body = JSON.parse(String(init.body));
    assert.equal(body.contents[0].parts[0].inlineData.data, Buffer.from('image').toString('base64'));
    assert.equal(body.generationConfig.responseJsonSchema.additionalProperties, false);
    assert.match(body.systemInstruction.parts[0].text, /WITHOUT Nitro/);
    return response();
  });
  assert.deepEqual(await readGeminiImage(key, defaultGeminiModel, Buffer.from('image'), 'image/png'), price);
  await assert.rejects(readGeminiImage(key, '../bad-model', Buffer.from('image'), 'image/png'), /GEMINI_MODEL_UNAVAILABLE/);
  assert.equal(calls, 1);
});

test('provider failures and invalid output are sanitized and never retried automatically', async t => {
  for (const [status, code] of [[400, 'GEMINI_REQUEST_REJECTED'], [403, 'GEMINI_KEY_INVALID'], [404, 'GEMINI_MODEL_UNAVAILABLE'], [429, 'GEMINI_QUOTA_EXCEEDED'], [503, 'GEMINI_UNAVAILABLE']] as const) {
    let calls = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(key, { status, headers: { 'Retry-After': '120' } }); });
    await assert.rejects(readGeminiImage(key, defaultGeminiModel, Buffer.from('x'), 'image/png'), (error: unknown) => {
      assert.ok(error instanceof GeminiReadError);
      assert.equal(error.code, code);
      assert.ok(!error.message.includes(key));
      if (status === 429) assert.equal(error.retryAfterMs, 120000);
      return true;
    });
    assert.equal(calls, 1);
    mock.mock.restore();
  }
  const mock = t.mock.method(globalThis, 'fetch', async () => response({ ...price, standardPriceSatang: 'wrong' }));
  await assert.rejects(readGeminiImage(key, defaultGeminiModel, Buffer.from('x'), 'image/png'), /GEMINI_INVALID_RESPONSE/);
  mock.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => { throw new Error(`secret ${key}`); });
  await assert.rejects(readGeminiImage(key, defaultGeminiModel, Buffer.from('x'), 'image/png'), /GEMINI_UNAVAILABLE/);
});

test('truncated, oversized and malformed Gemini responses never become prices', async t => {
  for (const makeResponse of [
    () => new Response('x'.repeat(65_537)),
    () => new Response('not-json'),
    () => Response.json(null),
    () => Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(price) }] } }] }),
  ]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => makeResponse());
    await assert.rejects(readGeminiImage(key, defaultGeminiModel, Buffer.from('x'), 'image/png'), /GEMINI_INVALID_RESPONSE/);
    mock.mock.restore();
  }
});

test('version 3 reads multiple Discord attachments with AI and retains ACTIVE status on quota errors', async t => {
  const client = new EventEmitter();
  const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'white' } }).png().toBuffer();
  let googleCalls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    if (String(url).startsWith('https://cdn.discordapp.com/')) return new Response(image, { headers: { 'content-type': 'image/png' } });
    googleCalls++;
    return new Response('not exposed', { status: 429, headers: { 'retry-after': '60' } });
  });
  const reports: unknown[] = [];
  let complete!: (value: Record<string, unknown>) => void;
  const finished = new Promise<Record<string, unknown>>(resolve => { complete = resolve; });
  const context = { client, botId: 'bot', guildId: 'guild', config: { ...config, PRICE_READER_CHANNEL_ID: '123456789012345678' },
    secrets: { GEMINI_API_KEY: key }, presentations: {}, reportFeatureError: async (...args: unknown[]) => { reports.push(args); } } as unknown as FeatureContext;
  const feature = getFeature('price-reader', '3.0.0')!;
  assert.equal(getFeature('price-reader', '2.0.0')?.version, '2.0.0');
  const stop = await feature.activate(context);
  client.emit('messageCreate', { author: { bot: false }, channelId: '123456789012345678',
    attachments: new Map(['1','2'].map(id => [id, { id, url: `https://cdn.discordapp.com/attachments/1/${id}/test.png`, contentType: 'image/png' }])),
    reply: async () => ({ flags: { has: () => false }, edit: async (payload: Record<string, unknown>) => complete(payload) }) });
  const result = await finished;
  await stop();
  assert.equal(googleCalls, 1, 'remaining images reuse the cooldown without consuming quota');
  assert.deepEqual(result.allowedMentions, { parse: [] });
  assert.match(JSON.stringify(result), /โควตา Gemini/);
  assert.ok(reports.length >= 1);
  assert.deepEqual((reports[0] as unknown[])[2], { recoverable: true });
  assert.equal(client.listenerCount('messageCreate'), 0);
});
