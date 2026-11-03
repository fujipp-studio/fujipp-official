import type { PriceRule } from './classified-pricing.js';
export interface CountedPriceRule extends PriceRule { itemCount: number; giftPriceSatang?: number | null }
export function validCountedPriceRules(value: unknown): value is CountedPriceRule[] {
  if (!Array.isArray(value) || value.length > 400) return false;
  const keys = new Set<string>();
  return value.every(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !['SINGLE', 'BUNDLE'].includes(row.itemType)
      || !['STANDARD', 'NITRO'].includes(row.pricingMode) || !Number.isInteger(row.itemCount)
      || row.itemCount < 1 || row.itemCount > 5 || (row.itemType === 'SINGLE') !== (row.itemCount === 1)
      || !Number.isSafeInteger(row.discordPriceSatang) || row.discordPriceSatang < 1 || row.discordPriceSatang > 100_000_000
      || !(row.giftPriceSatang === undefined || row.giftPriceSatang === null || Number.isSafeInteger(row.giftPriceSatang) && row.giftPriceSatang >= 0 && row.giftPriceSatang <= 100_000_000)
      || !Number.isSafeInteger(row.shopPriceSatang) || row.shopPriceSatang < 0 || row.shopPriceSatang > 100_000_000) return false;
    const key = `${row.itemCount}/${row.pricingMode}/${row.discordPriceSatang}`;
    if (keys.has(key)) return false;
    keys.add(key); return true;
  });
}
