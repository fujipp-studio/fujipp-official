import { describe, expect, it } from 'vitest'
import { invalidActionRowPath } from '@/features/bots/models/presentation'

describe('Components V2 action rows', () => {
  it.each([undefined, [], Array.from({ length: 6 }, () => ({ type: 2 }))])(
    'locates invalid root rows without mutating the definition',
    (components) => {
      const definition = {
        mode: 'COMPONENTS_V2',
        components: [{ type: 10 }, { type: 1, components }],
      }
      const before = structuredClone(definition)
      expect(invalidActionRowPath(definition)).toBe('components[1].components')
      expect(definition).toEqual(before)
    },
  )
  it.each([1, 5])('accepts %i buttons and a single select inside a container', (count) => {
    expect(
      invalidActionRowPath({
        mode: 'COMPONENTS_V2',
        components_v2: {
          components: [
            {
              type: 17,
              components: [
                { type: 1, components: Array.from({ length: count }, () => ({ type: 2 })) },
                { type: 1, components: [{ type: 3 }] },
              ],
            },
          ],
        },
      }),
    ).toBeNull()
  })
  it('ignores inactive Components V2 layouts on Embed messages', () => {
    expect(
      invalidActionRowPath({
        mode: 'EMBED',
        components_v2: { components: [{ type: 1, components: [] }] },
      }),
    ).toBeNull()
  })
})
