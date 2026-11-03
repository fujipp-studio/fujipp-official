export * from './price-reader-base'
import {
  priceReaderRuntimeConfig,
  priceReaderPricePairs,
  validatePriceReaderCommonDraft,
} from './price-reader-base'
import { buildResultValues, imageError } from '@price-reader/result-presentation'
import { readCountedGeminiResult, validCountedPriceRules } from '@price-reader/counted-pricing'
import {
  localizedCountedConfig,
  countedItemTemplate,
  countedErrorTemplate,
  languageValues,
  priceTextVariables,
} from '@price-reader/counted-text'

export const readPriceReaderResult = readCountedGeminiResult
export function validatePriceReaderDraft(values: Record<string, unknown>): boolean {
  return (
    ['TH', 'EN'].includes(String(values.PRICE_READER_LANGUAGE)) &&
    validCountedPriceRules(priceReaderRuntimeConfig(values).PRICE_READER_COUNT_PRICE_RULES) &&
    validatePriceReaderCommonDraft(values) &&
    ['STANDARD', 'NITRO', 'BOTH'].includes(String(values.PRICE_READER_PRICING_MODE))
  )
}
export function priceReaderSampleValues(
  values: Record<string, unknown>,
  version: string,
  guildId?: string | null,
  scenario: 'success' | 'mixed' | 'error' | 'ocr_error' | 'unmatched' = 'success',
): Record<string, string> {
  const config = localizedCountedConfig({
    PRICE_READER_RESULTS_ITEM_TEMPLATE: countedItemTemplate,
    PRICE_READER_ERROR_ITEM_TEMPLATE: countedErrorTemplate,
    ...priceReaderRuntimeConfig(values),
  })
  const rules = validCountedPriceRules(config.PRICE_READER_COUNT_PRICE_RULES)
    ? config.PRICE_READER_COUNT_PRICE_RULES
    : []
  const selected = rules
    .filter((row, index) =>
      config.PRICE_READER_PRICING_MODE === 'BOTH'
        ? rules.findIndex((other) => other.itemCount === row.itemCount) === index
        : row.pricingMode === config.PRICE_READER_PRICING_MODE,
    )
    .slice(0, 2)
  const rows = selected.length
    ? selected
    : [{ itemType: 'SINGLE', itemCount: 1, pricingMode: 'STANDARD', discordPriceSatang: 25000 }]
  const results =
    scenario === 'error' || scenario === 'ocr_error'
      ? [imageError(config, scenario === 'error' ? 'not_found' : 'ocr_error')]
      : rows.map((row) =>
          readCountedGeminiResult(
            {
              itemName: 'Discord Shop',
              currency: 'THB',
              itemType: row.itemType,
              itemCount: row.itemCount,
              standardPriceSatang:
                scenario === 'unmatched'
                  ? 99999900
                  : row.pricingMode === 'STANDARD'
                    ? row.discordPriceSatang
                    : (rules.find(
                        (other) =>
                          other.itemCount === row.itemCount && other.pricingMode === 'STANDARD',
                      )?.discordPriceSatang ?? null),
              nitroPriceSatang:
                scenario === 'unmatched'
                  ? 99999900
                  : row.pricingMode === 'NITRO'
                    ? row.discordPriceSatang
                    : (rules.find(
                        (other) =>
                          other.itemCount === row.itemCount && other.pricingMode === 'NITRO',
                      )?.discordPriceSatang ?? null),
              originalPriceSatang: null,
              discountPercent: null,
              ambiguous: false,
            },
            config,
          ),
        )
  if (scenario === 'mixed') results.push(imageError(config, 'not_found'))
  return buildResultValues(results, config, version, guildId, languageValues(config))
}

export function priceReaderBuildResultValues(
  results: Parameters<typeof buildResultValues>[0],
  config: Record<string, unknown>,
  version: string,
  guildId?: string | null,
) {
  return buildResultValues(results, config, version, guildId, languageValues(config))
}

export const priceReaderVariables = [
  ...priceTextVariables,
  'item_type',
  'item_type_key',
  'item_count',
  'pricing_mode',
  'pricing_mode_key',
  'image_label',
  'discord_price_label',
  'shop_price_label',
]
export function priceReaderConfiguredPairs(values: Record<string, unknown>) {
  return priceReaderPricePairs(values.PRICE_READER_COUNT_PRICE_RULES)
}
