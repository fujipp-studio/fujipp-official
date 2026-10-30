import {
  buildResultValues,
  readImageResult,
  imageError,
  defaultItemTemplate,
} from '@price-reader/results'

export { priceReaderConfigKeys } from './price-reader-keys'

export const priceReaderItemTemplate = defaultItemTemplate

export function priceReaderPricePairs(value: unknown) {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const amount = (satang: unknown, baht: unknown) =>
      typeof satang === 'number' && Number.isFinite(satang)
        ? Math.round(satang)
        : typeof baht === 'number' && Number.isFinite(baht)
          ? Math.round(baht * 100)
          : NaN
    const discord = amount(item.discordPriceSatang, item.discordPrice)
    const shop = amount(item.shopPriceSatang, item.shopPrice)
    return discord > 0 && shop >= 0 ? [{ discord, shop }] : []
  })
}

/** Convert editable form values without changing the draft. */
export function priceReaderRuntimeConfig(values: Record<string, unknown>): Record<string, unknown> {
  const config = { ...values }
  for (const key of ['PRICE_READER_PRICE_MAP', 'PRICE_READER_RESULT_BLOCKS']) {
    if (typeof config[key] === 'string') {
      try {
        config[key] = JSON.parse(config[key])
      } catch {
        config[key] = []
      }
    }
  }
  for (const key of [
    'PRICE_READER_MATCH_TOLERANCE_SATANG',
    'PRICE_READER_NO_NITRO_MARKUP_SATANG',
  ]) {
    if (config[key] !== undefined && config[key] !== '') config[key] = Number(config[key])
  }
  return config
}

export function validatePriceReaderDraft(values: Record<string, unknown>): boolean {
  const mode = values.PRICE_READER_RESULT_MODE
  if (mode !== undefined && mode !== 'TEMPLATE' && mode !== 'BLOCKS') return false
  const tolerance = values.PRICE_READER_MATCH_TOLERANCE_SATANG
  if (
    tolerance !== undefined &&
    (tolerance === '' ||
      !Number.isSafeInteger(Number(tolerance)) ||
      Number(tolerance) < 0 ||
      Number(tolerance) > 5000)
  )
    return false
  for (const key of [
    'PRICE_READER_NOT_FOUND_TEXT',
    'PRICE_READER_OCR_ERROR_TEXT',
    'PRICE_READER_UNMATCHED_PRICE_TEXT',
    'PRICE_READER_ERROR_ITEM_TEMPLATE',
    'PRICE_READER_RESULTS_ITEM_TEMPLATE',
    'PRICE_READER_RESULTS_SEPARATOR',
  ]) {
    if (values[key] === undefined) continue
    const value = values[key]
    const max = key.endsWith('SEPARATOR') ? 100 : key.endsWith('TEMPLATE') ? 4000 : 1000
    if (
      typeof value !== 'string' ||
      value.length > max ||
      (!key.endsWith('SEPARATOR') && !value.trim())
    )
      return false
  }
  if (values.PRICE_READER_RESULT_BLOCKS === undefined) return true
  let blocks: unknown
  try {
    blocks =
      typeof values.PRICE_READER_RESULT_BLOCKS === 'string'
        ? JSON.parse(values.PRICE_READER_RESULT_BLOCKS)
        : values.PRICE_READER_RESULT_BLOCKS
  } catch {
    return false
  }
  if (!Array.isArray(blocks) || blocks.length > 12) return false
  const ids = new Set<string>()
  let activeLength = 0
  for (const block of blocks) {
    if (
      !block ||
      typeof block !== 'object' ||
      typeof block.id !== 'string' ||
      !block.id.trim() ||
      block.id.length > 64 ||
      ids.has(block.id) ||
      typeof block.enabled !== 'boolean' ||
      typeof block.text !== 'string' ||
      block.text.length > 1000 ||
      (block.enabled && !block.text.trim())
    )
      return false
    ids.add(block.id)
    if (block.enabled) activeLength += block.text.length + 1
  }
  return (
    mode === 'TEMPLATE' ||
    (blocks.length === 0 && mode !== 'BLOCKS') ||
    (activeLength > 0 && activeLength <= 4001)
  )
}

export function priceReaderSampleValues(
  values: Record<string, unknown>,
  version: string,
  guildId?: string | null,
  scenario: 'success' | 'mixed' | 'error' | 'ocr_error' | 'unmatched' = 'success',
): Record<string, string> {
  const config = priceReaderRuntimeConfig(values)
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
