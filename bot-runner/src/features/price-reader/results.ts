import { extractPrices, extractStandardPrices, lookupPriceEntry, readPriceMap } from "./price-extractor.js";

export type PriceReaderConfig = Record<string, unknown>;
export type ImageResult = Record<string, string> & { status: "success" | "error" };
export interface ResultBlock { id: string; enabled: boolean; text: string }

export const defaultItemTemplate = (withMarkup: boolean) =>
  "### รูปที่ {{result_index}}\n💙 **ราคาดิสคอร์ด**\n`{{discord_price}} บาท`" +
  (withMarkup ? "{{discount_text}}" : "") +
  "\n💗 **ราคาร้านขาย**\n`{{shop_price_text}}`" +
  (withMarkup ? "\n💛 **ราคาไม่มีไนโตร บวกชิ้นละ**\n`{{no_nitro_markup}} บาท`" : "");

export const defaultErrorItemTemplate = "### รูปที่ {{result_index}}\n❌ {{error_message}}";
export const defaultNotFoundText = "ไม่พบราคาที่รองรับในรูปนี้ กรุณาตรวจสอบว่ารูปมีราคาเป็นเงินบาทและลองส่งอีกครั้ง";
export const defaultOcrErrorText = "เกิดข้อผิดพลาดขณะอ่านรูป กรุณาลองส่งรูปอีกครั้ง";
export const defaultUnmatchedText = "ไม่พบราคาที่ตรงกัน";
export const defaultSeparator = "\n\n---\n\n";
export const itemVariables = ["result_index", "item_name", "discord_price", "shop_price", "shop_price_text", "discount_text", "matched_discord_price", "match_distance"];

export function configText(config: PriceReaderConfig, key: string, fallback: string): string {
  return typeof config[key] === "string" ? config[key] : fallback;
}
export function matchTolerance(config: PriceReaderConfig): number {
  const value = config.PRICE_READER_MATCH_TOLERANCE_SATANG;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 5000 ? value : 500;
}
export function resultBlocks(value: unknown): ResultBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter((block): block is ResultBlock =>
    Boolean(block) && typeof block === "object" && !Array.isArray(block) &&
    typeof block.id === "string" && typeof block.enabled === "boolean" && typeof block.text === "string",
  );
}
export function replaceVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([a-z0-9_]+)}}/gi, (match, key: string) => values[key] ?? match);
}
export const money = (satang: number) => (satang / 100).toFixed(2);

export function imageError(config: PriceReaderConfig, kind: "not_found" | "ocr_error"): ImageResult {
  return {
    status: "error",
    error_message: kind === "not_found"
      ? configText(config, "PRICE_READER_NOT_FOUND_TEXT", defaultNotFoundText)
      : configText(config, "PRICE_READER_OCR_ERROR_TEXT", defaultOcrErrorText),
  };
}

/** Browser rehearsal and Discord use the same price selection, matching and text rendering. */
export function readImageResult(ocrText: string, config: PriceReaderConfig, version: string): ImageResult {
  const prices = version.startsWith("1.") ? extractPrices(ocrText) : extractStandardPrices(ocrText);
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

export function buildResultValues(results: ImageResult[], config: PriceReaderConfig, version: string, guildId?: string | null): Record<string, string> {
  const success = results.filter((result) => result.status === "success");
  const withMarkup = version.startsWith("1.");
  const markup = config.PRICE_READER_NO_NITRO_MARKUP_SATANG;
  const common: Record<string, string> = withMarkup
    ? { no_nitro_markup: money(typeof markup === "number" && Number.isSafeInteger(markup) && markup >= 0 ? markup : 1000) }
    : {};
  const blocks = resultBlocks(config.PRICE_READER_RESULT_BLOCKS);
  const blockText = blocks.filter((block) => block.enabled).map((block) => block.text).join("\n");
  const useBlocks = config.PRICE_READER_RESULT_MODE === "BLOCKS" || (config.PRICE_READER_RESULT_MODE === undefined && blocks.length > 0);
  const template = useBlocks && blockText.trim() ? blockText
    : configText(config, "PRICE_READER_RESULTS_ITEM_TEMPLATE", defaultItemTemplate(withMarkup));
  const sections = results.map((result, index) => replaceVariables(
    result.status === "error" ? configText(config, "PRICE_READER_ERROR_ITEM_TEMPLATE", defaultErrorItemTemplate) : template,
    { ...common, ...result, result_index: String(index + 1) },
  ));
  const orderId = String(config.PRICE_READER_ORDER_CHANNEL_ID ?? "");
  return {
    ...common,
    ...(success[0] ?? {}),
    image_count: String(results.length),
    success_count: String(success.length),
    error_count: String(results.length - success.length),
    order_url: guildId && /^\d{15,30}$/.test(orderId) ? `https://discord.com/channels/${guildId}/${orderId}` : "",
    results_text: sections.join(configText(config, "PRICE_READER_RESULTS_SEPARATOR", defaultSeparator)),
    error_message: results.filter((result) => result.status === "error").map((result) => result.error_message).join("\n"),
  };
}
