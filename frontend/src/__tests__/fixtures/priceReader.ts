import type { FeatureConfiguration } from '@/features/bots/api'
import { configuration, license } from './domain'
import { priceReaderItemTemplate } from '@/features/bots/config/price-reader'

export function priceReaderFixture(version = '2.0.0') {
  const legacy = version.startsWith('1.')
  const mode = legacy ? 'EMBED' : 'COMPONENTS_V2'
  const priceLicense = {
    ...license,
    featureCode: 'price-reader',
    featureName: 'Price Reader',
    version,
  }
  const config: FeatureConfiguration = {
    ...structuredClone(configuration),
    fields: [
      {
        key: 'PRICE_READER_CHANNEL_ID',
        type: 'CHANNEL_ID',
        value: '123456789012345678',
        required: true,
        validation: { pattern: '^[0-9]{15,30}$' },
      },
      {
        key: 'PRICE_READER_ORDER_CHANNEL_ID',
        type: 'CHANNEL_ID',
        value: '',
        required: false,
        validation: { pattern: '^[0-9]{15,30}$' },
      },
      {
        key: 'PRICE_READER_PRICE_MAP',
        type: 'JSON',
        value: [
          { discordPrice: 250, shopPrice: 55, future: { keep: true } },
          { discordPrice: 295, shopPrice: 65 },
        ],
        required: true,
        validation: { type: 'array' },
      },
      ...(legacy
        ? [
            {
              key: 'PRICE_READER_NO_NITRO_MARKUP_SATANG',
              type: 'INTEGER',
              value: 1000,
              required: true,
              validation: { minimum: 0 },
            },
            {
              key: 'PRICE_READER_RESULTS_ITEM_TEMPLATE',
              type: 'TEXT',
              value: priceReaderItemTemplate(true),
              required: true,
              validation: { minLength: 1, maxLength: 4000 },
              ui: {
                variables: [
                  'result_index',
                  'discord_price',
                  'discount_text',
                  'shop_price_text',
                  'no_nitro_markup',
                ],
              },
            },
          ]
        : []),
      {
        key: 'FUTURE_SETTING',
        type: 'STRING',
        value: 'preserved',
        required: true,
        validation: null,
      },
    ].map((item) => ({
      label: item.key,
      description: '',
      secret: false,
      configured: true,
      defaultValue: item.value,
      ui: null,
      ...item,
    })) as FeatureConfiguration['fields'],
    presentations: [
      {
        key: 'processing',
        availableVariables: ['image_count'],
        defaultDefinition: {
          mode,
          title: '⏳ กำลังอ่านราคา',
          description: 'กำลังอ่านราคาจากรูป... ({{image_count}} รูป)',
          future: { keep: true },
        },
      },
      {
        key: 'result',
        availableVariables: [
          'image_count',
          'success_count',
          'error_count',
          'discord_price',
          'shop_price',
          'shop_price_found',
          'item_name',
          'order_url',
          'results_text',
          ...(legacy ? ['no_nitro_markup'] : []),
        ],
        defaultDefinition: {
          mode,
          embed: {
            title: '💗 ผลการอ่าน ( จำนวน {{image_count}} รูป )',
            description: '{{results_text}}',
          },
          components: [
            {
              type: 17,
              components: [
                { type: 10, content: '💗 **ผลการอ่าน ( จำนวน {{image_count}} รูป )**' },
                { type: 14, divider: true, spacing: 2 },
                { type: 10, content: '{{results_text}}' },
                { type: 14, divider: true, spacing: 2 },
                { type: 10, content: '🟡🟢🩷🟣🔵🩷🔴🟡🟢🔵🔴🩷🟡🟣🔵🟢🔴🩷🟡🟣' },
              ],
            },
          ],
          links: [{ url: '{{order_url}}', label: 'สั่งซื้อคลิก', emoji: '🍃' }],
          future: { keep: true },
        },
      },
    ].map((slot, index) => ({
      slotId: `price-slot-${index}`,
      label: slot.key,
      description: '',
      type: 'COMPONENTS_V2',
      overrideDefinition: null,
      ...slot,
    })),
  }
  return { priceLicense, config }
}
