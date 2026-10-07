import type { FeatureConfiguration } from '@/features/bots/api'
import { configuration, license } from './domain'

export function channelMessageTriggersFixture() {
  const triggerLicense = {
    ...license,
    featureCode: 'channel-message-triggers',
    featureName: 'Channel Message Triggers',
    version: '1.0.0',
  }
  const config: FeatureConfiguration = {
    ...structuredClone(configuration),
    fields: [
      {
        key: 'CHANNEL_CREATE_RULES',
        label: 'Channel creation',
        description: '',
        type: 'JSON',
        required: true,
        secret: false,
        configured: true,
        defaultValue: [],
        value: [
          { categoryId: '123456789012345678', template: 'template_1', future: { retained: true } },
        ],
        validation: { type: 'array', maxItems: 25 },
        ui: { control: 'message-trigger-rules', kind: 'channel-create' },
      },
      {
        key: 'ADMIN_MESSAGE_TRIGGERS',
        label: 'Administrator triggers',
        description: '',
        type: 'JSON',
        required: true,
        secret: false,
        configured: true,
        defaultValue: [],
        value: [{ trigger: 'pay', template: 'template_2', future: 'keep' }],
        validation: { type: 'array', maxItems: 25 },
        ui: { control: 'message-trigger-rules', kind: 'admin-message' },
      },
      {
        key: 'FUTURE_SETTING',
        label: 'Future setting',
        description: '',
        type: 'STRING',
        required: false,
        secret: false,
        configured: true,
        defaultValue: 'preserved',
        value: 'preserved',
        validation: null,
        ui: null,
      },
    ],
    presentations: Array.from({ length: 10 }, (_, index) => ({
      slotId: `template-slot-${index + 1}`,
      key: `template_${index + 1}`,
      label: `Message Template ${index + 1}`,
      description: 'Reusable message',
      type: 'EMBED',
      availableVariables: [
        'channel',
        'channel_name',
        'channel_id',
        'category',
        'category_id',
        'category_name',
        'guild_name',
        'admin',
        'admin_name',
        'admin_id',
        'trigger',
      ],
      defaultDefinition: {
        mode: index === 1 ? 'COMPONENTS_V2' : 'EMBED',
        embed: { title: `Template ${index + 1}`, description: 'Automatic message' },
        components_v2: {
          components: [
            {
              type: 17,
              components: [{ type: 10, content: `## Template ${index + 1}\nAutomatic message` }],
            },
          ],
        },
      },
      overrideDefinition: null,
    })),
  }
  return { triggerLicense, config }
}
