import type { FeatureConfiguration } from '@/features/bots/api'
import { newTicketCategory, defaultTicketBehavior } from '@/features/bots/config/ticket-config'
import { configuration, license } from './domain'

export function ticketFixture() {
  const ticketLicense = {
    ...license,
    featureCode: 'ticket',
    featureName: 'Ticket',
    version: '1.0.0',
  }
  const topics = ['order', 'support'].map((key, index) => ({
    ...newTicketCategory(key, index ? 'แจ้งปัญหา' : 'สั่งซื้อ'),
    categoryId: '111111111111111111',
    supportRoleIds: ['222222222222222222'],
    formEnabled: true,
    fields: [
      {
        key: 'details',
        label: index ? 'รายละเอียดปัญหา' : 'สินค้าที่ต้องการ',
        style: 'PARAGRAPH',
        required: true,
        placeholder: '',
      },
    ],
  }))
  const config = {
    ...structuredClone(configuration),
    fields: [
      { key: 'TICKET_COMMAND_NAME', type: 'STRING', value: 'ticket' },
      { key: 'TICKET_CATEGORIES', type: 'JSON', value: topics },
      { key: 'TICKET_DISCORD_HISTORY_ENABLED', type: 'BOOLEAN', value: false },
      { key: 'TICKET_BEHAVIOR', type: 'JSON', value: defaultTicketBehavior },
    ].map((field) => ({
      ...field,
      label: field.key,
      description: '',
      required: true,
      secret: false,
      defaultValue: field.value,
      configured: true,
      validation: null,
      ui: null,
    })),
    presentations: ['panel', 'opened'].map((key) => ({
      slotId: `ticket-${key}`,
      key,
      label: key === 'panel' ? 'แผงเปิดตั๋ว' : 'ข้อความต้อนรับในตั๋ว',
      description: '',
      type: 'COMPONENTS_V2',
      availableVariables: key === 'opened' ? ['user', 'category', 'auto_close'] : [],
      defaultDefinition: {
        mode: 'COMPONENTS_V2',
        embed: { title: 'Ticket', description: 'Select a topic' },
        components_v2: {
          components: [
            {
              type: 10,
              content:
                key === 'panel'
                  ? '## Ticket\nเลือกหัวข้อเพื่อติดต่อทีมดูแล'
                  : '{{user}} · {{category}}\n{{auto_close}}',
            },
          ],
        },
      },
      overrideDefinition: null,
    })),
  } as FeatureConfiguration
  return { ticketLicense, config }
}
