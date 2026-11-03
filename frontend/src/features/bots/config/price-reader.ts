export * from './price-reader-base'
import {
  priceReaderRuntimeConfig,
  priceReaderPricePairs,
  validatePriceReaderCommonDraft,
} from './price-reader-base'
import {
  buildResultValues,
  readImageResult,
  imageError,
  readGeminiResult,
} from '@price-reader/results'
import {
  validPriceRules,
  readClassifiedGeminiResult,
  classifiedResultVariables,
} from '@price-reader/classified-pricing'

export function validatePriceReaderDraft(values: Record<string, unknown>): boolean {
  if (values.PRICE_READER_PRICING_MODE !== undefined) {
    if (!['STANDARD', 'NITRO', 'BOTH'].includes(String(values.PRICE_READER_PRICING_MODE)))
      return false
    if (!validPriceRules(priceReaderRuntimeConfig(values).PRICE_READER_PRICE_RULES)) return false
  }
  return validatePriceReaderCommonDraft(values)
}

export function priceReaderSampleValues(
  values: Record<string, unknown>,
  version: string,
  guildId?: string | null,
  scenario: 'success' | 'mixed' | 'error' | 'ocr_error' | 'unmatched' = 'success',
): Record<string, string> {
  const config = priceReaderRuntimeConfig(values)
  if (version === '3.1.0') {
    const rules = validPriceRules(config.PRICE_READER_PRICE_RULES)
      ? config.PRICE_READER_PRICE_RULES
      : []
    const selected = rules
      .filter((row, index) =>
        config.PRICE_READER_PRICING_MODE === 'BOTH'
          ? rules.findIndex((rule) => rule.itemType === row.itemType) === index
          : row.pricingMode === config.PRICE_READER_PRICING_MODE,
      )
      .slice(0, 2)
    const samples = selected.length
      ? selected
      : [{ itemType: 'SINGLE', pricingMode: 'STANDARD', discordPriceSatang: 25000 }]
    const results =
      scenario === 'error' || scenario === 'ocr_error'
        ? [imageError(config, scenario === 'error' ? 'not_found' : 'ocr_error')]
        : samples.map((row) =>
            readClassifiedGeminiResult(
              {
                itemName: 'Discord Shop',
                currency: 'THB',
                itemType: row.itemType,
                standardPriceSatang:
                  scenario === 'unmatched'
                    ? 99999900
                    : row.pricingMode === 'STANDARD'
                      ? row.discordPriceSatang
                      : (rules.find(
                          (rule) =>
                            rule.itemType === row.itemType && rule.pricingMode === 'STANDARD',
                        )?.discordPriceSatang ?? null),
                nitroPriceSatang:
                  scenario === 'unmatched'
                    ? 99999900
                    : row.pricingMode === 'NITRO'
                      ? row.discordPriceSatang
                      : (rules.find(
                          (rule) => rule.itemType === row.itemType && rule.pricingMode === 'NITRO',
                        )?.discordPriceSatang ?? null),
                originalPriceSatang: null,
                discountPercent: null,
                ambiguous: false,
              },
              config,
            ),
          )
    if (scenario === 'mixed') results.push(imageError(config, 'not_found'))
    return buildResultValues(results, config, version, guildId)
  }
  const pairs = priceReaderPricePairs(config.PRICE_READER_PRICE_MAP)
  const prices = pairs.length ? pairs.slice(0, 2).map((pair) => pair.discord) : [25000, 29500]
  const results =
    scenario === 'error' || scenario === 'ocr_error'
      ? [imageError(config, scenario === 'error' ? 'not_found' : 'ocr_error')]
      : scenario === 'unmatched'
        ? [readImageResult('Discord Shop\nTHB 999999.00', config, version)]
        : prices.map((price, index) =>
            readImageResult(
              `Discord Shop ${index + 1}\nTHB ${(price / 100).toFixed(2)}`,
              config,
              version,
            ),
          )
  if (scenario === 'mixed') results.push(imageError(config, 'not_found'))
  return buildResultValues(results, config, version, guildId)
}

export function readPriceReaderResult(
  data: unknown,
  config: Record<string, unknown>,
  _selectedCount?: number,
) {
  return config.PRICE_READER_PRICING_MODE === undefined
    ? readGeminiResult(data, config)
    : readClassifiedGeminiResult(data, config)
}

export const priceReaderBuildResultValues = buildResultValues

export const priceReaderVariables = classifiedResultVariables
export function priceReaderConfiguredPairs(values: Record<string, unknown>) {
  return priceReaderPricePairs(
    values.PRICE_READER_PRICING_MODE === undefined
      ? values.PRICE_READER_PRICE_MAP
      : values.PRICE_READER_PRICE_RULES,
  )
}

export const readPriceReaderOcrResult = readImageResult
