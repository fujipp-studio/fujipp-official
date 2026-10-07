import type { FeatureConfiguration } from '@/features/bots/api'
import { configuration, license } from './domain'

export function reviewCreditFixture(version: '1.0.0' | '1.1.0') {
  const reviewLicense = {
    ...license,
    featureCode: 'review-credit',
    featureName: 'Review Credit',
    version,
  }
  const reply = 'ขอบคุณสำหรับรีวิว 💖\nกลับมาใช้บริการได้เสมอครับ'
  const config: FeatureConfiguration = {
    ...structuredClone(configuration),
    presentations: [],
    fields: [
      { key: 'REVIEW_CHANNEL_ID', type: 'CHANNEL_ID', value: '123456789012345678', required: true },
      { key: 'REVIEW_COMMAND_NAME', type: 'STRING', value: 'review', required: true },
      {
        key: 'REVIEW_CHANNEL_NAME_TEMPLATE',
        type: 'STRING',
        value: '💯・review-{count}',
        required: true,
      },
      { key: 'REVIEW_REACTIONS', type: 'STRING_LIST', value: ['💖', '⭐'] },
      {
        key: 'REVIEW_REPLY_MESSAGES',
        type: 'STRING_LIST',
        value: [reply, 'ขอบคุณที่ไว้วางใจครับ'],
      },
      { key: 'REVIEW_DELETE_OLD_REPLY', type: 'BOOLEAN', value: true, required: true },
      { key: 'REVIEW_ROLE_ID', type: 'ROLE_ID', value: '' },
      ...(version === '1.1.0'
        ? [{ key: 'REVIEW_COUNT_WEBHOOKS', type: 'BOOLEAN', value: true, required: true }]
        : []),
      { key: 'FUTURE_SETTING', type: 'STRING', value: 'preserved' },
    ].map((item) => ({
      label: item.key,
      description: '',
      defaultValue: item.value,
      required: false,
      secret: false,
      configured: true,
      ui: null,
      validation: null,
      ...item,
    })),
  }
  return { reviewLicense, config, reply }
}
