import type { FeatureConfiguration } from '@/features/bots/api'
import { configuration, license } from './domain'

export const memberSpendingLicense = {
  ...license,
  featureCode: 'member-spending',
  featureName: 'Member Spending Card',
}

function field(
  key: string,
  type: string,
  value: boolean | number | string | null,
): FeatureConfiguration['fields'][number] {
  return {
    key,
    type,
    label: key,
    description: '',
    value,
    defaultValue: value,
    required: type === 'BOOLEAN' || type === 'INTEGER',
    secret: type === 'SECRET',
    configured: type === 'SECRET' || value !== null,
    validation: null,
    ui: null,
  }
}

export const memberSpendingPresentations: FeatureConfiguration['presentations'] = [
  {
    slotId: 'member-first-card',
    key: 'first_card',
    label: 'บัตรสะสมครั้งแรก',
    description: 'การ์ดเมื่อเพิ่มสมาชิกครั้งแรก',
    type: 'EMBED',
    availableVariables: ['member', 'member_mention', 'today', 'total', 'count', 'avatar'],
    defaultDefinition: {
      mode: 'EMBED',
      embeds: [
        {
          color: 16761571,
          title: '💗 บัตรสะสมของ {{member}}',
          description:
            'ยินดีต้อนรับสมาชิกใหม่ {{member_mention}}\nยอดรอบนี้ **{{today}} บาท**\nยอดสะสม **{{total}} บาท** · **{{count}} ครั้ง**',
          thumbnail: { url: '{{avatar}}' },
        },
      ],
    },
    overrideDefinition: null,
  },
  {
    slotId: 'member-returning-card',
    key: 'returning_card',
    label: 'บัตรสะสมครั้งถัดไป',
    description: 'การ์ดเมื่อลูกค้ากลับมาใช้บริการ',
    type: 'COMPONENTS_V2',
    availableVariables: ['member', 'member_mention', 'today', 'total', 'count', 'avatar'],
    defaultDefinition: {
      mode: 'COMPONENTS_V2',
      components: [
        {
          type: 17,
          components: [
            {
              type: 10,
              content:
                '## 💗 บัตรสะสมของ {{member}}\nขอบคุณที่กลับมาใช้บริการอีกครั้ง {{member_mention}}',
            },
            { type: 14, divider: true, spacing: 2 },
            {
              type: 10,
              content:
                'ยอดรอบนี้ **{{today}} บาท**\nยอดสะสมทั้งหมด **{{total}} บาท**\nใช้บริการแล้ว **{{count}} ครั้ง**',
            },
          ],
        },
      ],
    },
    overrideDefinition: null,
  },
  {
    slotId: 'member-leaderboard',
    key: 'leaderboard',
    label: 'อันดับยอดสะสม',
    description: 'รายการอันดับสมาชิก',
    type: 'COMPONENTS_V2',
    availableVariables: ['leaderboard_lines', 'member_count'],
    defaultDefinition: {
      mode: 'COMPONENTS_V2',
      components: [
        {
          type: 17,
          components: [
            { type: 10, content: '## 🏆 อันดับยอดสะสม\n{{leaderboard_lines}}' },
            { type: 14, divider: true, spacing: 1 },
            { type: 10, content: 'สมาชิกในรายการ {{member_count}} คน' },
          ],
        },
      ],
    },
    overrideDefinition: null,
  },
]

export const memberSpendingConfiguration: FeatureConfiguration = {
  ...configuration,
  fields: [
    field('SPENDING_DB_USE_OWN', 'BOOLEAN', false),
    field('SPENDING_DB_URL', 'SECRET', null),
    field('SPENDING_FIRST_ROLE_ID', 'ROLE_ID', '123456789012345678'),
    { ...field('SPENDING_UPGRADE_TIERS', 'JSON', null), value: [], defaultValue: [] },
    field('SPENDING_TIER_STACK', 'BOOLEAN', true),
    field('SPENDING_COUNT_ENABLED', 'BOOLEAN', false),
    field('SPENDING_UPGRADE_COUNT', 'INTEGER', 5),
    field('SPENDING_TOP1_ROLE_ID', 'ROLE_ID', null),
    field('SPENDING_TOP5_ROLE_ID', 'ROLE_ID', null),
    {
      ...field('COMMAND_PERMISSION_RULES', 'JSON', null),
      label: 'สิทธิ์การใช้คำสั่ง',
      value: [],
      defaultValue: [],
    },
  ],
  presentations: memberSpendingPresentations,
}
