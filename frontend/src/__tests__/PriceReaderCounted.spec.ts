import { describe, it, expect } from 'vitest'
import {
  priceReaderSampleValues,
  validatePriceReaderDraft,
  readPriceReaderResult,
} from '@/features/bots/config/price-reader-counted'
import { priceReaderCountedFixture } from './fixtures/priceReaderCounted'

describe('Counted Price Reader settings', () => {
  function draft(language = 'TH') {
    const { config } = priceReaderCountedFixture(language)
    return Object.fromEntries(
      config.fields
        .filter((row) => !row.secret)
        .map((row) => [row.key, row.type === 'JSON' ? JSON.stringify(row.value) : row.value]),
    )
  }
  it('previews the provided price tables with language-specific standard text', () => {
    for (const language of ['TH', 'EN']) {
      const values = draft(language)
      expect(validatePriceReaderDraft(values)).toBe(true)
      const preview = priceReaderSampleValues(values, '3.2.0')
      expect(preview.item_count).toBe('1')
      expect(preview.results_text).toContain(language === 'EN' ? 'Shop price' : 'ราคารับกด')
      expect(preview.results_text).not.toContain('{{default}}')
      expect(preview.results_text).not.toContain('{{image_label}}')
      expect(preview.results_heading).toBe(language === 'EN' ? 'Price results' : 'ผลการอ่านราคา')
    }
  })
  it('blocks missing counts, duplicate entries and unsupported response languages', () => {
    const values = draft()
    expect(validatePriceReaderDraft({ ...values, PRICE_READER_LANGUAGE: 'AUTO' })).toBe(false)
    expect(validatePriceReaderDraft({ ...values, PRICE_READER_COUNT_PRICE_RULES: '[{}]' })).toBe(
      false,
    )
    const rows = JSON.parse(String(values.PRICE_READER_COUNT_PRICE_RULES))
    expect(
      validatePriceReaderDraft({
        ...values,
        PRICE_READER_COUNT_PRICE_RULES: JSON.stringify([...rows, rows[0]]),
      }),
    ).toBe(false)
  })
  it('defers an unclear bundle until the same read is confirmed locally', () => {
    const values = draft('EN')
    const config = {
      ...values,
      PRICE_READER_PRICING_MODE: 'NITRO',
      PRICE_READER_COUNT_PRICE_RULES: JSON.parse(String(values.PRICE_READER_COUNT_PRICE_RULES)),
    }
    const image = {
      itemName: 'Bundle',
      currency: 'THB',
      itemType: 'BUNDLE',
      itemCount: null,
      standardPriceSatang: null,
      nitroPriceSatang: 47500,
      originalPriceSatang: null,
      discountPercent: null,
      ambiguous: false,
    }
    expect(readPriceReaderResult(image, config).pending_read).toBeTruthy()
    expect(readPriceReaderResult(image, config, 2).shop_price_text).toBe('100.00 THB')
    expect(readPriceReaderResult(image, config, 3).shop_price_text).toBe('140.00 THB')
  })
  it('previews custom tier text and validates the three formatting controls', () => {
    const values = {
      ...draft('EN'),
      PRICE_READER_BOTH_DISCORD_TEMPLATE: '💎 {{nitro_price_text}}\nRegular {{standard_price_text}}',
      PRICE_READER_BOTH_SHOP_TEMPLATE: 'Nitro ฿{{nitro_shop_amount_text}} · Regular ฿{{standard_shop_amount_text}}',
      PRICE_READER_MISSING_PRICE_TEXT: 'Ask us',
      PRICE_READER_RESULTS_ITEM_TEMPLATE: '{{discord_price}}\n{{shop_price_text}}',
    }
    expect(validatePriceReaderDraft(values)).toBe(true)
    const preview = priceReaderSampleValues(values, '3.2.0')
    expect(preview.results_text).toContain('💎 209.00\nRegular 250.00')
    expect(preview.results_text).toContain('Nitro ฿55.00 · Regular ฿65.00')
    for (const key of ['PRICE_READER_BOTH_DISCORD_TEMPLATE', 'PRICE_READER_BOTH_SHOP_TEMPLATE', 'PRICE_READER_MISSING_PRICE_TEXT']) {
      for (const invalid of ['', ' ', 'x'.repeat(1001), 1])
        expect(validatePriceReaderDraft({ ...values, [key]: invalid })).toBe(false)
      expect(validatePriceReaderDraft({ ...values, [key]: '{{default}}' })).toBe(true)
    }
  })
})
