const labels = {
  TH: { standard_label: 'ไม่มี Nitro', nitro_label: 'มี Nitro', image_label: 'รูปที่', discord_price_label: 'ราคา Discord', shop_price_label: 'ราคารับกด', currency_label: 'บาท', results_heading: 'ผลการอ่านราคา', processing_text: 'กำลังอ่านราคาจากรูป…', images_label: 'รูป', order_label: 'สั่งซื้อคลิก' },
  EN: { standard_label: 'Without Nitro', nitro_label: 'With Nitro', image_label: 'Image', discord_price_label: 'Discord price', shop_price_label: 'Shop price', currency_label: 'THB', results_heading: 'Price results', processing_text: 'Reading prices from images…', images_label: 'images', order_label: 'Order here' },
};
export const countedItemTemplate = '### {{image_label}} {{result_index}} · {{item_type}} · {{pricing_mode}}\n💙 **{{discord_price_label}}**\n`{{discord_price}} {{currency_label}}`\n💗 **{{shop_price_label}}**\n`{{shop_price_text}}`';
export const countedErrorTemplate = '### {{image_label}} {{result_index}}\n❌ {{error_message}}';
export const bothDiscordTemplate = '{{standard_label}}: {{standard_price_text}} / {{nitro_label}}: {{nitro_price_text}}';
export const bothShopTemplate = '{{standard_label}}: {{standard_shop_price_text}} / {{nitro_label}}: {{nitro_shop_price_text}}';
export const priceTextVariables = ['standard_label', 'nitro_label', 'standard_price', 'nitro_price', 'standard_price_text', 'nitro_price_text', 'standard_shop_price', 'nitro_shop_price', 'standard_shop_price_text', 'nitro_shop_price_text', 'standard_shop_amount_text', 'nitro_shop_amount_text', 'currency_label'];
export function languageValues(config: Record<string, unknown>): Record<string, string> {
  return config.PRICE_READER_LANGUAGE === undefined ? {} : labels[config.PRICE_READER_LANGUAGE === 'EN' ? 'EN' : 'TH'];
}
/** Translate standard defaults only; owner-authored text and designs stay under owner control. */
export function localizedCountedConfig(config: Record<string, unknown>): Record<string, unknown> {
  const en = config.PRICE_READER_LANGUAGE === 'EN';
  const defaults = {
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
