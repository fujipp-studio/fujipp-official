import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { messages } from '@/i18n/messages'

function flatten(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const path = prefix ? `${prefix}.${key}` : key
      return typeof entry === 'string'
        ? [[path, entry]]
        : Object.entries(flatten(entry as Record<string, unknown>, path))
    }),
  )
}

describe('translation namespaces', () => {
  it('keeps English and Thai keys in sync', () => {
    expect(Object.keys(flatten(messages.th)).sort()).toEqual(
      Object.keys(flatten(messages.en)).sort(),
    )
  })
  for (const locale of ['en', 'th'] as const) {
    it(`compiles all ${locale} messages, including literal bot variables`, () => {
      const i18n = createI18n({ legacy: false, locale, messages })
      for (const [key, message] of Object.entries(flatten(messages[locale]))) {
        const params = Object.fromEntries(
          [...message.matchAll(/\{(\w+)\}/g)].map((match) => [match[1], 'value']),
        )
        expect(() => i18n.global.t(key, params)).not.toThrow()
      }
      expect(
        i18n.global.t('botSettings.messageContentSupportsVariables', {
          variables: '{{variables}}',
        }),
      ).toContain('{{variables}}')
    })
  }
})
