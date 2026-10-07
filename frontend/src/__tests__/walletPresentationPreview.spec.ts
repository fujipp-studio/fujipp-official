import { describe, expect, it } from 'vitest'
import { walletPresentationPreview } from '../features/bots/models/wallet-presentation-preview'

describe('Wallet runtime presentation preview', () => {
  it('projects a flat receipt into the same Container, heading and Separator as runtime', () => {
    const definition = {
      mode: 'COMPONENTS_V2',
      title: '✅ ปรับยอดเงินสำเร็จ',
      description: '**สมาชิก** {{member_mention}}\n**จำนวน** {{amount}} THB',
      thumbnail_url: '{{member_avatar_url}}',
      footer: 'Not used by runtime',
      future: 'Keep this saved value',
    }
    const original = structuredClone(definition)
    expect(walletPresentationPreview(definition)).toEqual({
      mode: 'COMPONENTS_V2',
      components: [
        {
          type: 17,
          components: [
            { type: 10, content: '# ✅ ปรับยอดเงินสำเร็จ\n' },
            { type: 14, divider: true, spacing: 2 },
            { type: 10, content: definition.description },
          ],
        },
      ],
    })
    expect(definition).toEqual(original)
  })

  it('places optional media and overridden actions inside the generated Container', () => {
    const preview = walletPresentationPreview({
      mode: 'COMPONENTS_V2',
      title: 'Inactive root title',
      components_v2: {
        title: 'Current title',
        description: 'Current body',
        image_url: '{{qr_url}}',
        actions: ['wallet.topup', 'unsupported'],
        action_overrides: {
          'wallet.topup': { label: 'เติมเครดิต', style: 'primary', emoji: '⭐' },
        },
      },
    })
    const container = (preview.components as Record<string, unknown>[])[0]!
    expect(container.components).toMatchObject([
      { type: 10, content: '# Current title\n' },
      { type: 14, spacing: 2 },
      { type: 10, content: 'Current body' },
      { type: 12, items: [{ media: { url: '{{qr_url}}' } }] },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'fujipp:wallet:topup', label: 'เติมเครดิต', style: 1, emoji: '⭐' },
        ],
      },
    ])
    expect(preview).not.toHaveProperty('image_url')
    expect(preview).not.toHaveProperty('actions')
  })

  it('honors complete raw layouts, expanding reusable actions without appending legacy metadata', () => {
    const components = [{ type: 1, components: [{ action: 'wallet.balance' }] }]
    const preview = walletPresentationPreview({
      mode: 'COMPONENTS_V2',
      components,
      title: 'Unused',
      actions: ['wallet.topup'],
      components_v2: { components: [{ type: 10, content: 'Unused nested design' }] },
    })
    expect(preview.components).toEqual([
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: 'fujipp:wallet:balance',
            label: 'เช็คยอดเงินคงเหลือ',
            emoji: '💳',
            style: 2,
          },
        ],
      },
    ])
    expect(components).toEqual([{ type: 1, components: [{ action: 'wallet.balance' }] }])
  })

  it('retains nested raw Containers and appends their action row at the top level', () => {
    const container = { type: 17, components: [{ type: 10, content: 'Custom content' }] }
    const preview = walletPresentationPreview({
      mode: 'COMPONENTS_V2',
      components_v2: { components: [container], actions: ['wallet.promptpay'] },
    })
    expect((preview.components as unknown[])[0]).toEqual(container)
    expect((preview.components as unknown[])[1]).toMatchObject({
      type: 1,
      components: [{ style: 1 }],
    })
  })
})
