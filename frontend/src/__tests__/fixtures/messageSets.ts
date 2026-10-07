import type { FeatureConfiguration } from '@/features/bots/api'
import { configuration, license } from './domain'
export function messageSetsFixture() {
  const setsLicense = {
    ...license,
    featureCode: 'message-sets',
    featureName: 'Message Sets',
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
      field('MESSAGE_SETS_COMMAND_NAME', 'STRING', 'ec'),
      field('MESSAGE_SETS', 'JSON', [{ name: 'Welcome', presentationSlot: 'set_1' }]),
    ],
    presentations: Array.from({ length: 20 }, (_, index) => ({
      slotId: `set-slot-${index + 1}`,
      key: `set_${index + 1}`,
      label: `SET ${index + 1}`,
      description: '',
      type: 'EMBED',
      availableVariables: ['set_name', 'user', 'user_name', 'channel', 'guild_name'],
      defaultDefinition: {
        mode: 'EMBED',
        embed: { title: `SET ${index + 1}`, description: 'Designed message' },
        components_v2: {
          components: [
            {
              type: 17,
              components: [{ type: 10, content: `## SET ${index + 1}\nDesigned message` }],
            },
          ],
        },
      },
      overrideDefinition: null,
    })),
  } as FeatureConfiguration
  return { setsLicense, config }
}
