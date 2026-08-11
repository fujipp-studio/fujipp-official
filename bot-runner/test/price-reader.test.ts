import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPrices,
  lookupShopPrice,
  readPriceMap,
} from "../src/features/price-reader/price-extractor.js";

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
