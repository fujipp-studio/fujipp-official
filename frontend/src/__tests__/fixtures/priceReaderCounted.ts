import type { FeatureConfiguration } from '@/features/bots/api'
import { priceReaderFixture } from './priceReader'
import providedRules from '../../../../docs/examples/price-reader-count-prices.json' with { type: 'json' }
import {
  countedItemTemplate,
  countedErrorTemplate,
  languageValues,
  giftTextVariables,
} from '@price-reader/counted-text'
export { providedRules }
export function priceReaderCountedFixture(language = 'TH') {
  const result = priceReaderFixture('3.1.0')
  result.priceLicense.version = '3.2.0'
  const field = (key: string, type: string, value: unknown) =>
    ({
      key,
      label: key,
      description: '',
      type,
      value,
      defaultValue: value,
      required: true,
      secret: false,
      configured: true,
      validation: null,
      ui: null,
    }) as FeatureConfiguration['fields'][number]
  result.config.fields = result.config.fields.filter(
    (row) => row.key !== 'PRICE_READER_MATCH_TOLERANCE_SATANG',
  )
  result.config.fields.push(
    field('PRICE_READER_LANGUAGE', 'ENUM', language),
    field('PRICE_READER_COUNT_PRICE_RULES', 'JSON', providedRules),
    field('PRICE_READER_OFFER_MODE', 'ENUM', 'SHOP'),
    ...['PRICE_READER_GIFT_UNAVAILABLE_TEXT','PRICE_READER_BOTH_GIFT_TEMPLATE','PRICE_READER_OFFER_TEMPLATE'].map(key=>field(key,'TEXT','{{default}}')),
    ...['PRICE_READER_BOTH_DISCORD_TEMPLATE', 'PRICE_READER_BOTH_SHOP_TEMPLATE', 'PRICE_READER_MISSING_PRICE_TEXT'].map(key => field(key, 'TEXT', '{{default}}')),
  )
  for (const row of result.config.fields) {
    if (row.key === 'PRICE_READER_PRICING_MODE') row.value = 'BOTH'
    if (row.key === 'PRICE_READER_RESULTS_ITEM_TEMPLATE') row.value = countedItemTemplate
    if (row.key === 'PRICE_READER_ERROR_ITEM_TEMPLATE') row.value = countedErrorTemplate
    if (
      [
        'PRICE_READER_NOT_FOUND_TEXT',
        'PRICE_READER_OCR_ERROR_TEXT',
        'PRICE_READER_UNMATCHED_PRICE_TEXT',
      ].includes(row.key)
    )
      row.value = '{{default}}'
    row.defaultValue = row.value
  }
  for (const slot of result.config.presentations) {
    slot.availableVariables = [
      ...new Set([
        ...slot.availableVariables,
        ...(slot.key === 'result' ? [...giftTextVariables,'gift_price_found','offer_price_found'] : []),
        'item_count',
        ...Object.keys(languageValues({ PRICE_READER_LANGUAGE: language })),
      ]),
    ]
    slot.defaultDefinition =
      slot.key === 'processing'
        ? {
            mode: 'COMPONENTS_V2',
            title: '⏳ {{processing_text}}',
            description: '{{image_count}} {{images_label}}',
          }
        : {
            mode: 'COMPONENTS_V2',
            components: [
              {
                type: 17,
                components: [
                  {
                    type: 10,
                    content:
                      slot.key === 'result'
                        ? '{{results_heading}}\n{{results_text}}'
                        : '{{results_text}}',
                  },
                ],
              },
            ],
          }
  }
  return result
}
