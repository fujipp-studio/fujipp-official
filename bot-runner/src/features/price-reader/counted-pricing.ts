import type { ClassifiedGeminiPrice, PriceRule } from './classified-pricing.js';
import { parseGeminiPrice } from './gemini-contract.js';
import { replaceVariables, money, type ImageResult, type PriceReaderConfig } from './result-presentation.js';
import { languageValues, localizedCountedConfig } from './counted-text.js';

export interface CountedGeminiPrice extends ClassifiedGeminiPrice { itemCount: number | null }
export interface CountedPriceRule extends PriceRule { itemCount: number }
export function parseCountedGeminiPrice(value: unknown): CountedGeminiPrice {
  const base = parseGeminiPrice(value);
  const kind = (value as Record<string, unknown>).itemType;
  if (kind !== 'SINGLE' && kind !== 'BUNDLE' && kind !== 'UNKNOWN') throw new Error('GEMINI_INVALID_RESPONSE');
  const result: ClassifiedGeminiPrice = { ...base, itemType: kind };
  if (Object.keys(value as object).length !== 9) throw new Error('GEMINI_INVALID_RESPONSE');
  const count = (value as Record<string, unknown>).itemCount;
  if (!(count === null || typeof count === 'number' && Number.isInteger(count) && count >= 1 && count <= 100)
    || result.itemType === 'SINGLE' && count !== 1
    || result.itemType === 'BUNDLE' && count === 1
    || result.itemType === 'UNKNOWN' && count !== null) throw new Error('GEMINI_INVALID_RESPONSE');
  return { ...result, itemCount: count as number | null };
}
export function validCountedPriceRules(value: unknown): value is CountedPriceRule[] {
  if (!Array.isArray(value) || value.length > 400) return false;
  const keys = new Set<string>();
  return value.every(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !['SINGLE', 'BUNDLE'].includes(row.itemType)
      || !['STANDARD', 'NITRO'].includes(row.pricingMode) || !Number.isInteger(row.itemCount)
      || row.itemCount < 1 || row.itemCount > 5 || (row.itemType === 'SINGLE') !== (row.itemCount === 1)
      || !Number.isSafeInteger(row.discordPriceSatang) || row.discordPriceSatang < 1 || row.discordPriceSatang > 100_000_000
      || !Number.isSafeInteger(row.shopPriceSatang) || row.shopPriceSatang < 0 || row.shopPriceSatang > 100_000_000) return false;
    const key = `${row.itemCount}/${row.pricingMode}/${row.discordPriceSatang}`;
    if (keys.has(key)) return false;
    keys.add(key); return true;
  });
}
export function needsItemCount(data: CountedGeminiPrice): boolean {
  return !data.ambiguous && data.currency === 'THB' && (data.standardPriceSatang !== null || data.nitroPriceSatang !== null) && data.itemCount === null;
}
export function readCountedGeminiResult(value: unknown, input: PriceReaderConfig, selectedCount?: number): ImageResult {
  const data = parseCountedGeminiPrice(value);
  const config = localizedCountedConfig(input);
  const en = config.PRICE_READER_LANGUAGE === 'EN';
  const fail = (english: string, thai: string): ImageResult => ({ status: 'error', ...languageValues(config), error_message: en ? english : thai });
  if (data.ambiguous || data.currency !== 'THB' || data.standardPriceSatang === null && data.nitroPriceSatang === null)
    return fail('No unambiguous THB purchase price found. Send one complete listing.', 'ไม่พบราคาซื้อเงินบาทที่ชัดเจน กรุณาส่งรูปสินค้าเดียวให้ครบ');
  if (selectedCount !== undefined && (!needsItemCount(data) || !Number.isInteger(selectedCount) || selectedCount < (data.itemType === 'BUNDLE' ? 2 : 1) || selectedCount > 5))
    return fail('The selected item count is invalid.', 'จำนวนชิ้นที่เลือกไม่ถูกต้อง');
  const count = data.itemCount ?? selectedCount;
  if (count === undefined || count === null) return { ...fail('Choose the number of included items before quoting.', 'เลือกจำนวนสินค้าที่รวมอยู่ก่อนแสดงราคารับกด'), pending_read: JSON.stringify(data) };
  if (count > 5) return fail('Only single items and bundles of 2–5 items are supported.', 'รองรับชิ้นเดียวและบันเดิล 2–5 ชิ้นเท่านั้น');
  const rules = config.PRICE_READER_COUNT_PRICE_RULES;
  if (!validCountedPriceRules(rules)) return fail('Check the ten price tables in settings.', 'กรุณาตรวจสอบตารางราคาทั้ง 10 กลุ่มในการตั้งค่า');
  const mode = config.PRICE_READER_PRICING_MODE;
  if (!['STANDARD', 'NITRO', 'BOTH'].includes(String(mode))) return fail('Choose a pricing mode in settings.', 'กรุณาเลือกโหมดราคาในการตั้งค่า');
  const kind = count === 1 ? 'SINGLE' : 'BUNDLE';
  const quote = (tier: string, price: number | null): ImageResult | null => {
    if (price === null) return null;
    const entry = rules.find(row => row.itemType === kind && row.itemCount === count && row.pricingMode === tier && row.discordPriceSatang === price);
    const result: ImageResult = { status: 'success', item_name: data.itemName ?? '', discord_price: money(price),
      original_price: data.originalPriceSatang === null ? '' : money(data.originalPriceSatang),
      shop_price: entry ? money(entry.shopPriceSatang) : '', shop_price_found: String(Boolean(entry)),
      matched_discord_price: entry ? money(price) : '', match_distance: entry ? '0.00' : '' };
    result.shop_price_text = entry ? result.shop_price! : replaceVariables(String(config.PRICE_READER_UNMATCHED_PRICE_TEXT), result);
    return result;
  };
  const standard = quote('STANDARD', data.standardPriceSatang), nitro = quote('NITRO', data.nitroPriceSatang);
  const labels = languageValues(config);
  const unit = labels.currency_label, missing = String(config.PRICE_READER_MISSING_PRICE_TEXT);
  const shop = (result: ImageResult | null) => !result ? missing : result.shop_price_found === 'true' ? `${result.shop_price} ${unit}` : result.shop_price_text!;
  const vars: Record<string, string> = {
    ...labels, discount_text: data.discountPercent ? en ? ` (${data.discountPercent}% off)` : ` (ลด ${data.discountPercent}%)` : '', item_count: String(count), item_type_key: kind,
    item_type: count === 1 ? en ? 'Single item' : 'ชิ้นเดียว' : en ? `Bundle · ${count} items` : `บันเดิล ${count} ชิ้น`,
    pricing_mode_key: String(mode), pricing_mode: mode === 'BOTH' ? `${labels.standard_label} / ${labels.nitro_label}` : mode === 'NITRO' ? labels.nitro_label! : labels.standard_label!,
    standard_price: standard?.discord_price ?? '', nitro_price: nitro?.discord_price ?? '',
    standard_price_text: standard?.discord_price ?? missing, nitro_price_text: nitro?.discord_price ?? missing,
    standard_shop_price: standard?.shop_price ?? '', nitro_shop_price: nitro?.shop_price ?? '',
    standard_shop_price_text: shop(standard), nitro_shop_price_text: shop(nitro),
    standard_shop_amount_text: standard?.shop_price_text ?? missing, nitro_shop_amount_text: nitro?.shop_price_text ?? missing,
  };
  if (mode === 'BOTH') return { ...(standard ?? nitro)!, ...vars,
    discord_price: replaceVariables(String(config.PRICE_READER_BOTH_DISCORD_TEMPLATE), vars),
    shop_price: '', shop_price_text: replaceVariables(String(config.PRICE_READER_BOTH_SHOP_TEMPLATE), vars),
    shop_price_found: String(standard?.shop_price_found === 'true' && nitro?.shop_price_found === 'true'), matched_discord_price: '', match_distance: '' };
  const result = mode === 'NITRO' ? nitro : standard;
  if (!result) return fail(mode === 'NITRO' ? 'No visible Nitro price. Send a screenshot showing it.' : 'No visible standard price. Send a screenshot showing it.', mode === 'NITRO' ? 'ไม่พบราคา Nitro ในรูป กรุณาส่งรูปที่เห็นราคา Nitro' : 'ไม่พบราคาปกติในรูป กรุณาส่งรูปที่เห็นราคาสำหรับผู้ไม่มี Nitro');
  return { ...result, ...vars, shop_price_text: shop(result) };
}
