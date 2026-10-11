import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPrices,
  extractStandardPrices,
  lookupShopPrice,
  readPriceMap,
} from "../src/features/price-reader/price-extractor.js";
import { buildResultValues, readImageResult, imageError, matchTolerance } from "../src/features/price-reader/results.js";
import { priceReaderResultPayload } from "../src/features/price-reader/v1.0.0.js";
import type { FeatureContext } from "../src/types.js";

test("uses the error presentation only when every image fails, including custom templates", () => {
  const config = { PRICE_READER_NOT_FOUND_TEXT: "ส่งรูปใหม่", PRICE_READER_ERROR_ITEM_TEMPLATE: "{{result_index}}: {{error_message}}" };
  const context = { config, presentations: {
    error: { mode: "EMBED", title: "อ่านไม่ได้ {{error_count}} รูป", description: "{{results_text}}" },
    result: { mode: "EMBED", title: "อ่านได้ {{success_count}} / ไม่ได้ {{error_count}}", description: "{{results_text}}" },
  } } as unknown as FeatureContext;
  const error = imageError(config, "not_found");
  const allFailed = priceReaderResultPayload(context, [error], "2.0.0");
  assert.deepEqual((allFailed.embeds as Array<Record<string, unknown>>)[0]?.title, "อ่านไม่ได้ 1 รูป");
  assert.deepEqual((allFailed.embeds as Array<Record<string, unknown>>)[0]?.description, "1: ส่งรูปใหม่");
  const mixed = priceReaderResultPayload(context, [error, readImageResult("THB 250", config, "2.0.0")], "2.0.0");
  assert.equal((mixed.embeds as Array<Record<string, unknown>>)[0]?.title, "อ่านได้ 1 / ไม่ได้ 1");
  const fallback = priceReaderResultPayload({ ...context, presentations: {} }, [error], "2.0.0");
  assert.equal(JSON.stringify(fallback).includes("1: ส่งรูปใหม่"), true);
});

test("configured tolerance has inclusive bounds, exact matching and stable ties", () => {
  const map = readPriceMap([{ discordPrice: 250, shopPrice: 0 }, { discordPrice: 260, shopPrice: 60 }]);
  assert.equal(lookupShopPrice(25000, map, 0), 0);
  assert.equal(lookupShopPrice(25001, map, 0), null);
  assert.equal(lookupShopPrice(25500, map, 500), 0);
  assert.equal(lookupShopPrice(25500, map, 499), null);
  assert.equal(lookupShopPrice(25000, map, -1), null);
  assert.equal(matchTolerance({ PRICE_READER_MATCH_TOLERANCE_SATANG: 0 }), 0);
  assert.equal(matchTolerance({ PRICE_READER_MATCH_TOLERANCE_SATANG: 5001 }), 500);
});

test("rehearsal and runtime share Nitro selection, matching metadata and no-match text", () => {
  const config = { PRICE_READER_PRICE_MAP: [{ discordPrice: 250, shopPrice: 55 }], PRICE_READER_MATCH_TOLERANCE_SATANG: 0,
    PRICE_READER_UNMATCHED_PRICE_TEXT: "สอบถามราคา {{discord_price}}" };
  const text = "Shop item\nTHB 250\nNitro THB 209";
  assert.equal(readImageResult(text, config, "1.0.0").shop_price_text, "สอบถามราคา 209.00");
  const standard = readImageResult(text, config, "2.0.0");
  assert.equal(standard.matched_discord_price, "250.00");
  assert.equal(standard.match_distance, "0.00");
  assert.equal(standard.shop_price, "55.00");
});

test("blocks override templates, follow order and hide disabled fields without mutating config", () => {
  const config = { PRICE_READER_PRICE_MAP: [{ discordPrice: 250, shopPrice: 0 }], PRICE_READER_RESULTS_ITEM_TEMPLATE: "Legacy",
    PRICE_READER_RESULT_BLOCKS: [{ id: "shop", enabled: true, text: "ร้าน {{shop_price_text}}" }, { id: "hidden", enabled: false, text: "HIDDEN" }, { id: "index", enabled: true, text: "รูป {{result_index}}" }] };
  const before = structuredClone(config);
  const vars = buildResultValues([readImageResult("THB 250", config, "2.0.0")], config, "2.0.0");
  assert.equal(vars.results_text, "ร้าน 0.00 บาท\nรูป 1");
  assert.ok(!("no_nitro_markup" in vars));
  assert.deepEqual(config, before);
  assert.equal(buildResultValues([readImageResult("THB 250", config, "2.0.0")], { ...config, PRICE_READER_RESULT_BLOCKS: [] }, "2.0.0").results_text, "Legacy");
  assert.equal(buildResultValues([readImageResult("THB 250", config, "2.0.0")], { ...config, PRICE_READER_RESULT_MODE: "TEMPLATE" }, "2.0.0").results_text, "Legacy");
});

test("mixed and all-failed images keep original numbering and custom error text", () => {
  const config = { PRICE_READER_PRICE_MAP: [{ discordPrice: 250, shopPrice: 55 }],
    PRICE_READER_NOT_FOUND_TEXT: "ส่งรูปใหม่", PRICE_READER_OCR_ERROR_TEXT: "อ่านรูปผิดพลาด",
    PRICE_READER_ERROR_ITEM_TEMPLATE: "รูป {{result_index}}: {{error_message}}",
    PRICE_READER_RESULTS_ITEM_TEMPLATE: "รูป {{result_index}}: {{shop_price_text}} + {{no_nitro_markup}}",
    PRICE_READER_NO_NITRO_MARKUP_SATANG: 250, PRICE_READER_RESULTS_SEPARATOR: " | ",
    PRICE_READER_ORDER_CHANNEL_ID: "123456789012345678" };
  const failed = readImageResult("No currency", config, "1.0.0");
  const success = readImageResult("THB 250", config, "1.0.0");
  const vars = buildResultValues([failed, success, imageError(config, "ocr_error")], config, "1.0.0", "234567890123456789");
  assert.equal(vars.results_text, "รูป 1: ส่งรูปใหม่ | รูป 2: 55.00 บาท + 2.50 | รูป 3: อ่านรูปผิดพลาด");
  assert.equal(vars.success_count, "1");
  assert.equal(vars.error_count, "2");
  assert.equal(vars.image_count, "3");
  assert.equal(vars.order_url, "https://discord.com/channels/234567890123456789/123456789012345678");
  const allFailed = buildResultValues([failed], config, "2.0.0");
  assert.equal(allFailed.success_count, "0");
  assert.equal(allFailed.error_message, "ส่งรูปใหม่");
  assert.equal(allFailed.results_text, "รูป 1: ส่งรูปใหม่");
});

test("version 2 uses the repeated standard and purchase-button price instead of Nitro", () => {
  const result = extractStandardPrices(`
    บันเดิลราศีสิงห์
    ฿539 (-28%)
    ใช้ Nitro ในราคา ฿475
    ซื้อในราคา ฿539.00
  `);

  assert.equal(result.currentPriceSatang, 53_900);
  assert.equal(result.nitroPriceSatang, 47_500);
});

test("version 2 uses the standard THB price instead of the lower Nitro price", () => {
  const result = extractStandardPrices(`
    ดาวโปรยปราย
    THB 250.00
    ใช้ Nitro ในราคา THB 209.00 สมัครสมาชิกเลย
  `);

  assert.equal(result.currentPriceSatang, 25_000);
  assert.equal(result.nitroPriceSatang, 20_900);
});

test("version 2 does not fall back to a Nitro-only amount", () => {
  const result = extractStandardPrices("ใช้ Nitro ในราคา THB 209.00");

  assert.equal(result.currentPriceSatang, null);
  assert.equal(result.nitroPriceSatang, 20_900);
});

test("extracts an item name and Discord Shop prices from OCR text", () => {
  const result = extractPrices(`
    Cybernetic
    THB 739.00
    ใช้ Nitro ในราคา THB 589.00
    -20%
  `);

  assert.deepEqual(result, {
    currentPriceSatang: 58_900,
    originalPriceSatang: 73_900,
    nitroPriceSatang: 58_900,
    discountPercent: 20,
    itemName: "Cybernetic",
  });
});

test("reads a baht price map and matches a nearby OCR price", () => {
  const priceMap = readPriceMap([
    { discordPrice: 589, shopPrice: 240 },
    { discordPrice: 739, shopPrice: 290 },
  ]);

  assert.equal(lookupShopPrice(58_850, priceMap), 24_000);
  assert.equal(lookupShopPrice(60_000, priceMap), null);
});

test("recovers a price when OCR misreads the baht glyph before a discount", () => {
  const atGlyph = extractPrices("Bundle\n@440 (-12%)");
  const eightGlyph = extractPrices("Bundle\n8440 (-12%)");

  assert.equal(atGlyph.originalPriceSatang, 44_000);
  assert.equal(atGlyph.currentPriceSatang, 44_000);
  assert.equal(atGlyph.discountPercent, 12);
  assert.equal(eightGlyph.originalPriceSatang, 44_000);
  assert.equal(eightGlyph.currentPriceSatang, 44_000);
  assert.equal(eightGlyph.discountPercent, 12);
});

test("recovers a shop-card price when OCR reads the baht glyph as 8", () => {
  const result = extractPrices(`
    แก๊งตัวกลมม้วน
    8250
    ซือในราคา 8250.00
  `);

  assert.equal(result.currentPriceSatang, 25_000);
  assert.equal(result.originalPriceSatang, 25_000);
});

test("does not treat unrelated numbers as a price without a price context", () => {
  const result = extractPrices("Bundle 8250\nLimited edition");

  assert.equal(result.currentPriceSatang, null);
});

test("uses the discounted checkout amount instead of the crossed-out price", () => {
  const result = extractPrices("THB 256  ©  THB 209");
  const priceMap = readPriceMap([{ discordPrice: 209, shopPrice: 45 }]);

  assert.equal(result.originalPriceSatang, 25_600);
  assert.equal(result.currentPriceSatang, 20_900);
  assert.equal(lookupShopPrice(result.currentPriceSatang, priceMap), 4_500);
});
