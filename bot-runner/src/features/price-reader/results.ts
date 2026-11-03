import { extractPrices, extractStandardPrices, lookupPriceEntry, readPriceMap } from "./price-extractor.js";
import { parseGeminiPrice } from "./gemini-contract.js";

export * from "./result-presentation.js";
import { configText, defaultUnmatchedText, imageError, money, replaceVariables, type ImageResult, type PriceReaderConfig } from "./result-presentation.js";

export function matchTolerance(config: PriceReaderConfig): number {
  const value = config.PRICE_READER_MATCH_TOLERANCE_SATANG;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 5000 ? value : 500;
}
/** Browser rehearsal and Discord use the same price selection, matching and text rendering. */
export function readImageResult(ocrText: string, config: PriceReaderConfig, version: string): ImageResult {
  const prices = version.startsWith("1.") ? extractPrices(ocrText) : extractStandardPrices(ocrText);
  return priceResult(prices, config);
}

export function readGeminiResult(value: unknown, config: PriceReaderConfig): ImageResult {
  const data = parseGeminiPrice(value);
  if (data.ambiguous || data.currency !== "THB") return imageError(config, "not_found");
  return priceResult({ currentPriceSatang: data.standardPriceSatang, originalPriceSatang: data.originalPriceSatang,
    nitroPriceSatang: data.nitroPriceSatang, discountPercent: data.discountPercent, itemName: data.itemName }, config);
}

function priceResult(prices: { currentPriceSatang: number | null; originalPriceSatang: number | null; nitroPriceSatang: number | null; discountPercent: number | null; itemName: string | null }, config: PriceReaderConfig): ImageResult {
  if (!prices.currentPriceSatang) return imageError(config, "not_found");
  const entry = lookupPriceEntry(prices.currentPriceSatang, readPriceMap(config.PRICE_READER_PRICE_MAP), matchTolerance(config));
  const vars: ImageResult = {
    status: "success",
    item_name: prices.itemName ?? "",
    discord_price: money(prices.currentPriceSatang),
    original_price: prices.originalPriceSatang ? money(prices.originalPriceSatang) : "",
    nitro_price: prices.nitroPriceSatang ? money(prices.nitroPriceSatang) : "",
    discount_percent: prices.discountPercent ? String(prices.discountPercent) : "",
    discount_text: prices.discountPercent ? ` (ลด ${prices.discountPercent}%)` : "",
    shop_price: entry ? money(entry.shopPriceSatang) : "",
    shop_price_found: entry ? "true" : "false",
    matched_discord_price: entry ? money(entry.discordPriceSatang) : "",
    match_distance: entry ? money(Math.abs(entry.discordPriceSatang - prices.currentPriceSatang)) : "",
  };
  vars.shop_price_text = entry ? `${vars.shop_price} บาท`
    : replaceVariables(configText(config, "PRICE_READER_UNMATCHED_PRICE_TEXT", defaultUnmatchedText), vars);
  return vars;
}
