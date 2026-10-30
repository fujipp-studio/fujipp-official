import { describe, expect, it } from 'vitest'
import { parseMessageSets, validateMessageSets } from '@/features/bots/config/message-sets'

describe('Message Sets role mentions', () => {
  const set = { name: 'Rules', presentationSlot: 'set_1' }
  it('keeps existing SETs valid and preserves optional ping settings', () => {
    expect(validateMessageSets([set])).toBe(true)
    for (const allowRoleMentions of [true, false]) {
      const sets = [{ ...set, allowRoleMentions }]
      const parsed = parseMessageSets(JSON.stringify(sets))
      expect(parsed).toEqual(sets)
      expect(validateMessageSets(parsed)).toBe(true)
    }
  })
  it('rejects non-boolean ping settings', () => {
    for (const allowRoleMentions of ['true', 'false', 1, null, []]) {
      expect(
        validateMessageSets(parseMessageSets(JSON.stringify([{ ...set, allowRoleMentions }]))),
      ).toBe(false)
    }
  })
})
