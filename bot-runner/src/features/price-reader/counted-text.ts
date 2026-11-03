export { languageValues } from './counted-labels.js';
export const countedItemTemplate = '### {{image_label}} {{result_index}} · {{item_type}} · {{pricing_mode}}\n💙 **{{discord_price_label}}**\n`{{discord_price}} {{currency_label}}`\n💗 **{{shop_price_label}}**\n`{{shop_price_text}}`';
export const countedErrorTemplate = '### {{image_label}} {{result_index}}\n❌ {{error_message}}';
export const bothDiscordTemplate = '{{standard_label}}: {{standard_price_text}} / {{nitro_label}}: {{nitro_price_text}}';
export const bothShopTemplate = '{{standard_label}}: {{standard_shop_price_text}} / {{nitro_label}}: {{nitro_shop_price_text}}';
export const giftTextVariables = ['gift_label', 'gift_price', 'gift_price_text', 'standard_gift_price', 'nitro_gift_price', 'standard_gift_price_text', 'nitro_gift_price_text', 'standard_gift_amount_text', 'nitro_gift_amount_text', 'shop_label', 'shop_offer_text', 'offer_price_text', 'offer_mode_key', 'pricing_selection_key'];
export const priceTextVariables = [...giftTextVariables, 'standard_label', 'nitro_label', 'standard_price', 'nitro_price', 'standard_price_text', 'nitro_price_text', 'standard_shop_price', 'nitro_shop_price', 'standard_shop_price_text', 'nitro_shop_price_text', 'standard_shop_amount_text', 'nitro_shop_amount_text', 'currency_label'];
/** Translate standard defaults only; owner-authored text and designs stay under owner control. */
export function localizedCountedConfig(config: Record<string, unknown>): Record<string, unknown> {
  const en = config.PRICE_READER_LANGUAGE === 'EN';
  const defaults = {
    PRICE_READER_OFFER_MODE: 'SHOP',
    PRICE_READER_GIFT_UNAVAILABLE_TEXT: en ? 'Ask for Gift price' : 'สอบถามราคา Gift',
    PRICE_READER_BOTH_GIFT_TEMPLATE: '{{standard_label}}: {{standard_gift_price_text}} / {{nitro_label}}: {{nitro_gift_price_text}}',
    PRICE_READER_OFFER_TEMPLATE: '{{shop_label}}: {{shop_offer_text}} / 🎁 {{gift_label}}: {{gift_price_text}}',
    PRICE_READER_BOTH_DISCORD_TEMPLATE: bothDiscordTemplate,
    PRICE_READER_BOTH_SHOP_TEMPLATE: bothShopTemplate,
    PRICE_READER_MISSING_PRICE_TEXT: en ? 'Not visible in image' : 'ไม่พบราคาในรูป',
    PRICE_READER_UNMATCHED_PRICE_TEXT: en ? 'No matching shop price' : 'ไม่พบราคาที่ตรงกัน',
    PRICE_READER_NOT_FOUND_TEXT: en ? 'No supported THB price found. Send one complete listing.' : 'ไม่พบราคาเงินบาทที่รองรับ กรุณาส่งรูปสินค้าเดียวให้ครบ',
    PRICE_READER_OCR_ERROR_TEXT: en ? 'Unable to read the image. Please send it again.' : 'อ่านรูปไม่สำเร็จ กรุณาส่งรูปอีกครั้ง',
  };
  const result: Record<string, unknown> = { ...config, PRICE_READER_LANGUAGE: en ? 'EN' : 'TH' };
  for (const [key, fallback] of Object.entries(defaults)) if (result[key] === undefined || result[key] === '{{default}}') result[key] = fallback;
  return result;
}
