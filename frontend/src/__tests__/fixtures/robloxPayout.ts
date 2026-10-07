import type { FeatureConfiguration } from '@/features/bots/api'
import { configuration, license } from './domain'

export const robloxPayoutLicense = {
  ...license,
  featureCode: 'roblox-robux-payout',
  featureName: 'Roblox Robux Payout',
  version: '3.0.0',
}
type Field = FeatureConfiguration['fields'][number]
function field(
  key: string,
  type: string,
  value: Field['value'],
  validation: Field['validation'] = null,
): Field {
  return {
    key,
    type,
    value,
    defaultValue: value,
    label: key,
    description: '',
    required: !key.includes('CHANNEL'),
    secret: type === 'SECRET',
    configured: true,
    validation,
    ui: null,
  }
}
export const robloxPayoutConfiguration: FeatureConfiguration = {
  ...configuration,
  fields: [
    field('PANEL_COMMAND_NAME', 'STRING', 'robux-panel', { pattern: '^[a-z0-9_-]{1,32}$' }),
    field('ROBUX_ENABLED', 'BOOLEAN', true),
    field('ROBUX_RATE', 'DECIMAL', 3.5, { exclusiveMinimum: 0 }),
    field('ROBUX_PACKAGES', 'JSON', [{ robux: 350, future: 'preserved' }, { robux: 700 }]),
    field('ROBUX_PAYOUT_COOLDOWN_SECONDS', 'INTEGER', 30, { minimum: 0, maximum: 300 }),
    field('ROBLOX_GROUPS', 'JSON', [
      { key: 'main', name: 'Main Group', groupId: 12345, rate: 3.5, future: 'preserved' },
      { key: 'premium', name: 'Premium Group', groupId: 23456, rate: 4 },
    ]),
    field('ROBLOX_CREDENTIALS', 'SECRET', null),
    field('ROBUX_PANELS', 'JSON', [
      {
        key: 'main',
        name: 'Main shop',
        groupKeys: ['main', 'premium'],
        presentationSlot: 'panel_1',
        mode: 'storefront',
        future: 'preserved',
      },
      {
        key: 'membership',
        name: 'Membership check',
        groupKeys: ['main'],
        presentationSlot: 'panel_2',
        mode: 'membership_only',
      },
    ]),
    ...[
      'ROBUX_SUCCESS_NOTIFICATION_CHANNEL_ID',
      'ROBUX_ERROR_NOTIFICATION_CHANNEL_ID',
      'ROBUX_NOTIFICATION_CHANNEL_ID',
      'ROBUX_RECEIPT_CHANNEL_ID',
    ].map((key) => field(key, 'CHANNEL_ID', null)),
    field('FUTURE_ROBUX_SETTING', 'STRING', 'keep-this'),
  ],
  presentations: ['panel_1', 'panel_2', 'panel_3', 'succeeded', 'failed', 'manual_receipt'].map(
    (key) => ({
      slotId: 'robux-' + key,
      key,
      label: key,
      description: key,
      type: 'MESSAGE',
      availableVariables: ['stock_lines', 'amount'],
      defaultDefinition: {
        mode: 'EMBED',
        title: key.startsWith('panel') ? 'Robux shop' : key,
        description: 'Choose a Roblox group',
        future: 'preserved',
      },
      overrideDefinition: null,
    }),
  ),
}
