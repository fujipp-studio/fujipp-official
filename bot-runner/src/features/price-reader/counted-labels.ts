const labels = {
  TH: { gift_label: 'ราคา Gift', offer_label: 'ราคาที่ร้านเสนอ', standard_label: 'ไม่มี Nitro', nitro_label: 'มี Nitro', image_label: 'รูปที่', discord_price_label: 'ราคา Discord', shop_price_label: 'ราคารับกด', currency_label: 'บาท', results_heading: 'ผลการอ่านราคา', processing_text: 'กำลังอ่านราคาจากรูป…', images_label: 'รูป', order_label: 'สั่งซื้อคลิก' },
  EN: { gift_label: 'Gift price', offer_label: 'Quoted prices', standard_label: 'Without Nitro', nitro_label: 'With Nitro', image_label: 'Image', discord_price_label: 'Discord price', shop_price_label: 'Shop price', currency_label: 'THB', results_heading: 'Price results', processing_text: 'Reading prices from images…', images_label: 'images', order_label: 'Order here' },
};
export function languageValues(config: Record<string, unknown>): Record<string, string> {
  return config.PRICE_READER_LANGUAGE === undefined ? {} : labels[config.PRICE_READER_LANGUAGE === 'EN' ? 'EN' : 'TH'];
}
