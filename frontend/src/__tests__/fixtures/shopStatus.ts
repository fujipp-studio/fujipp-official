import type { FeatureConfiguration } from '@/features/bots/api'
import { configuration, license } from './domain'
export function shopStatusFixture() {
  const shopLicense = {
    ...license,
    featureCode: 'shop-status',
    featureName: 'Shop Status',
    version: '1.0.0',
  }
  const field = (key: string, type: string, value: unknown) => ({
    key,
    label: key,
    description: '',
    type,
    required: true,
    secret: false,
    configured: true,
    defaultValue: value,
    value,
    validation: null,
    ui: null,
  })
  const config = {
    ...structuredClone(configuration),
    fields: [
      field('SHOP_COMMAND_NAME', 'STRING', 'shop'),
      field('SHOP_OPEN_COMMAND', 'STRING', 'open'),
      field('SHOP_CLOSE_COMMAND', 'STRING', 'close'),
      field('SHOP_ANNOUNCEMENT_CHANNEL_ID', 'STRING', ''),
      field('SHOP_OPEN_MESSAGE_TYPE', 'ENUM', 'DESIGNED'),
      field('SHOP_CLOSE_MESSAGE_TYPE', 'ENUM', 'DESIGNED'),
      field('SHOP_OPEN_TEXT', 'TEXT', 'เปิดร้านแล้ว'),
      field('SHOP_CLOSE_TEXT', 'TEXT', 'ปิดร้านแล้ว'),
      field('SHOP_PERMISSION_RULES', 'JSON', []),
    ],
    presentations: ['open', 'close'].map((state, index) => ({
      slotId: `shop-slot-${state}`,
      key: `shop_${state}`,
      label: state === 'open' ? 'เปิดร้าน' : 'ปิดร้าน',
      description: '',
      type: 'EMBED',
      availableVariables: ['status', 'user', 'user_name', 'channel', 'guild_name'],
      defaultDefinition: {
        mode: 'EMBED',
        embed: {
          title: state === 'open' ? 'เปิดร้านแล้ว' : 'ปิดร้านแล้ว',
          description: '{{guild_name}} · {{status}}',
          color: index ? 15548997 : 5763719,
        },
        components_v2: {
          components: [
            { type: 17, components: [{ type: 10, content: '## {{status}}\n{{guild_name}}' }] },
          ],
        },
      },
      overrideDefinition: null,
    })),
  } as FeatureConfiguration
  return { shopLicense, config }
}
