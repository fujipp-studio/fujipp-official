import { classifiedGeminiPricePrompt, classifiedGeminiPriceSchema } from './classified-pricing.js';
export { parseCountedGeminiPrice } from './counted-pricing.js';
export type { CountedGeminiPrice } from './counted-pricing.js';
export const countedGeminiPriceSchema = {
  ...classifiedGeminiPriceSchema,
  properties: { ...classifiedGeminiPriceSchema.properties, itemCount: { type: ['integer', 'null'], minimum: 1, maximum: 100 } },
  required: [...classifiedGeminiPriceSchema.required, 'itemCount'],
};
export const countedGeminiPricePrompt = classifiedGeminiPricePrompt + `
Read Thai and English listing text. Return itemCount: the number of distinct products INCLUDED in this one purchase, not the number of screenshots, preview tabs, backgrounds, variants or decorative thumbnails.
Use explicit included-item text such as "includes 3 items", "bundle of 3", "บันเดิลประกอบไปด้วยไอเทม 3 รายการ", or a complete unambiguous list of included products.
SINGLE has itemCount=1. BUNDLE has itemCount>=2 when supported by visible evidence; otherwise itemCount=null. UNKNOWN always has itemCount=null.
Never infer the count from price, Nitro membership, a product name alone, or a partially visible list. Keep explicit counts above 5 so unsupported bundles are rejected safely.`;
