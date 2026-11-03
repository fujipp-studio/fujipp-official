const labels = {
  TH: { image_label: 'รูปที่', discord_price_label: 'ราคา Discord', shop_price_label: 'ราคารับกด', currency_label: 'บาท', results_heading: 'ผลการอ่านราคา', processing_text: 'กำลังอ่านราคาจากรูป…', images_label: 'รูป', order_label: 'สั่งซื้อคลิก' },
  EN: { image_label: 'Image', discord_price_label: 'Discord price', shop_price_label: 'Shop price', currency_label: 'THB', results_heading: 'Price results', processing_text: 'Reading prices from images…', images_label: 'images', order_label: 'Order here' },
};
export const countedItemTemplate = '### {{image_label}} {{result_index}} · {{item_type}} · {{pricing_mode}}\n💙 **{{discord_price_label}}**\n`{{discord_price}} {{currency_label}}`\n💗 **{{shop_price_label}}**\n`{{shop_price_text}}`';
export const countedErrorTemplate = '### {{image_label}} {{result_index}}\n❌ {{error_message}}';
export function languageValues(config: Record<string, unknown>): Record<string, string> {
  return config.PRICE_READER_LANGUAGE === undefined ? {} : labels[config.PRICE_READER_LANGUAGE === 'EN' ? 'EN' : 'TH'];
}
/** Translate standard defaults only; owner-authored text and designs stay under owner control. */
export function localizedCountedConfig(config: Record<string, unknown>): Record<string, unknown> {
  const en = config.PRICE_READER_LANGUAGE === 'EN';
  const defaults = {
    PRICE_READER_UNMATCHED_PRICE_TEXT: en ? 'No matching shop price' : 'ไม่พบราคาที่ตรงกัน',
    PRICE_READER_NOT_FOUND_TEXT: en ? 'No supported THB price found. Send one complete listing.' : 'ไม่พบราคาเงินบาทที่รองรับ กรุณาส่งรูปสินค้าเดียวให้ครบ',
    PRICE_READER_OCR_ERROR_TEXT: en ? 'Unable to read the image. Please send it again.' : 'อ่านรูปไม่สำเร็จ กรุณาส่งรูปอีกครั้ง',
  };
  const result: Record<string, unknown> = { ...config, PRICE_READER_LANGUAGE: en ? 'EN' : 'TH' };
  for (const [key, fallback] of Object.entries(defaults)) if (result[key] === undefined || result[key] === '{{default}}') result[key] = fallback;
  return result;
}
