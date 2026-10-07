import type { FeatureConfiguration } from '@/features/bots/api'
import { configuration, license } from './domain'

export const runtimeAlertLicense = {
  ...license,
  featureCode: 'runtime-expiry-alert',
  featureName: 'Runtime Expiry Alert',
  version: '1.0.0',
}
export const runtimeAlertConfiguration: FeatureConfiguration = {
  ...configuration,
  fields: [
    {
      key: 'RUNTIME_ALERT_DELIVERY',
      type: 'ENUM',
      value: 'CHANNEL',
      validation: { enum: ['CHANNEL', 'DM', 'BOTH', 'DISABLED'] },
    },
    { key: 'RUNTIME_ALERT_CHANNEL_ID', type: 'CHANNEL_ID', value: '123456789012345678' },
    { key: 'RUNTIME_ALERT_DM_USER_ID', type: 'STRING', value: '987654321098765432' },
    ...['7D', '3D', '1D', '1H'].map((key) => ({
      key: `RUNTIME_ALERT_${key}`,
      type: 'BOOLEAN',
      value: true,
    })),
  ].map((item) => ({
    label: item.key,
    description: '',
    required: !['CHANNEL_ID', 'STRING'].includes(item.type),
    secret: false,
    defaultValue: item.value,
    configured: true,
    ui: null,
    validation: null,
    ...item,
  })),
  presentations: [
    {
      slotId: 'runtime-alert-slot',
      key: 'expiry_alert',
      label: 'แจ้งเตือนใกล้หมดอายุ',
      description: 'ข้อความแจ้งเตือน Runtime ใกล้หมดอายุ',
      type: 'EMBED',
      availableVariables: ['bot_name', 'remaining', 'expires_at', 'auto_renew', 'renew_url'],
      overrideDefinition: null,
      defaultDefinition: {
        mode: 'EMBED',
        embeds: [
          {
            color: 1118481,
            title: 'แจ้งเตือน Runtime ใกล้หมดอายุ',
            description: 'Runtime สำหรับ **{{bot_name}}** กำลังจะหมดอายุ กรุณาต่ออายุก่อนถึงกำหนด',
            fields: [
              { name: 'เหลือเวลา', value: '{{remaining}}', inline: true },
              { name: 'หมดอายุ', value: '{{expires_at}}', inline: false },
              { name: 'ต่ออายุอัตโนมัติ', value: '{{auto_renew}}', inline: true },
            ],
          },
        ],
        links: [{ url: '{{renew_url}}', label: 'ตรวจสอบและต่ออายุ', emoji: '⏳' }],
      },
    },
  ],
}
