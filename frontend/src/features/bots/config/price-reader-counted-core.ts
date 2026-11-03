export * from './price-reader-base'
import { priceReaderRuntimeConfig, priceReaderPricePairs, validatePriceReaderCommonDraft } from './price-reader-base'
import { validCountedPriceRules } from '@price-reader/counted-rules'
export function validatePriceReaderDraft(values: Record<string, unknown>): boolean {
  return (
    ['TH', 'EN'].includes(String(values.PRICE_READER_LANGUAGE)) &&
    validCountedPriceRules(priceReaderRuntimeConfig(values).PRICE_READER_COUNT_PRICE_RULES) &&
    validatePriceReaderCommonDraft(values) &&
    (values.PRICE_READER_OFFER_MODE === undefined || ['SHOP', 'GIFT', 'BOTH'].includes(String(values.PRICE_READER_OFFER_MODE))) &&
    ['STANDARD', 'NITRO', 'BOTH', 'AUTO'].includes(String(values.PRICE_READER_PRICING_MODE))
  )
}
export function priceReaderConfiguredPairs(values: Record<string, unknown>) {
  return priceReaderPricePairs(values.PRICE_READER_COUNT_PRICE_RULES)
}

import { languageValues } from '@price-reader/counted-labels'
export function priceReaderProcessingValues(values: Record<string, unknown>) { return { ...languageValues(values), image_count: '2', success_count: '0', error_count: '0' } }
