import { describe, expect, it } from 'vitest'
import { paymentTriggerPresentationPreview } from '../features/bots/models/payment-trigger-presentation-preview'
import { paymentTriggerSampleValues } from '../features/bots/config/payment-trigger'
import { paymentTriggerFixture } from './fixtures/paymentTrigger'

const buttons = [
  { type: 2, label: 'スキャン', style: 4, emoji: '⭐' },
  { type: 2, label: 'ชำระผ่าน Wallet', style: 1, emoji: '🟠' },
]
describe('Payment Trigger preview', () => {
  it.each(['EMBED', 'COMPONENTS_V2'] as const)(
    'preserves the saved %s design and always uses runtime bank/Wallet order and fallbacks',
    (mode) => {
      const { config } = paymentTriggerFixture(mode)
      const raw = config.presentations[0]!.defaultDefinition
      raw.components = {
        wallet_button: { future: true },
        bank_button: { label: 'スキャン', emoji: ' ⭐ ', style: 'DANGER', future: 'keep' },
        unsupported: { label: 'Not a runtime button' },
      }
      const original = structuredClone(raw)
      const preview = paymentTriggerPresentationPreview(raw, 'method_selector')
      const previewAction =
        mode === 'COMPONENTS_V2'
          ? (preview.components as unknown[]).at(-1)
          : { type: 1, components: Object.values(preview.components as object) }
      const previewBody =
        mode === 'COMPONENTS_V2' ? (preview.components as unknown[]).slice(0, -1) : preview.embed
      const expectedBody =
        mode === 'COMPONENTS_V2'
          ? (raw.components_v2 as Record<string, unknown>).components
          : raw.embed
      expect(previewAction).toMatchObject({ type: 1, components: buttons })
      expect(previewBody).toEqual(expectedBody)
      expect(raw).toEqual(original)
    },
  )
  it('adds default selector buttons to flat raw Components V2 without losing the container', () => {
    const raw = {
      mode: 'COMPONENTS_V2',
      components: [{ type: 17, components: [{ type: 10, content: 'Body' }] }],
    }
    expect(paymentTriggerPresentationPreview(raw, 'method_selector').components).toMatchObject([
      raw.components[0],
      {
        type: 1,
        components: [
          { label: 'สแกน QR ธนาคาร', style: 3 },
          { label: 'ชำระผ่าน Wallet', style: 1 },
        ],
      },
    ])
  })
  it.each(['bank_payment', 'wallet_payment', 'invalid_amount'])(
    'does not show selector buttons on %s',
    (slot) => {
      const { config } = paymentTriggerFixture()
      const raw = config.presentations.find((item) => item.key === slot)!.defaultDefinition
      raw.components = { bank_button: { label: 'Ignored by runtime' } }
      expect(paymentTriggerPresentationPreview(raw, slot).components).toEqual(
        (raw.components_v2 as Record<string, unknown>).components,
      )
    },
  )
  it('calculates the Wallet surcharge from configured satang and handles a zero fee', () => {
    expect(paymentTriggerSampleValues({ WALLET_FEE_SATANG: '250' })).toMatchObject({
      amount: '10',
      fee_amount: '2.5',
      total_amount: '12.5',
    })
    expect(paymentTriggerSampleValues({ WALLET_FEE_SATANG: 0 })).toMatchObject({
      fee_amount: '0',
      total_amount: '10',
    })
    expect(paymentTriggerSampleValues({})).toMatchObject({
      fee_amount: '5',
      total_amount: '15',
      qr_image_url: '',
      wallet_number: '',
    })
  })
  it.each(['EMBED', 'COMPONENTS_V2'] as const)(
    'shows the envelope button in %s only when enabled without changing the saved design',
    (mode) => {
      const { config } = paymentTriggerFixture(mode)
      const definition = config.presentations[0]!.defaultDefinition
      const original = structuredClone(definition)
      const preview = paymentTriggerPresentationPreview(definition, 'method_selector', true)
      const buttons =
        mode === 'EMBED'
          ? Object.values(preview.components as object)
          : (preview.components as Array<{ components: unknown[] }>).at(-1)!.components
      expect(buttons).toHaveLength(3)
      expect(buttons[2]).toMatchObject({ label: 'ชำระด้วยซองอั่งเปา', emoji: '🧧', style: 4 })
      expect(definition).toEqual(original)
      const receipt = config.presentations.find(
        (slot) => slot.key === 'payment_success',
      )!.defaultDefinition
      const receiptPreview = paymentTriggerPresentationPreview(receipt, 'payment_success', true)
      expect(
        mode === 'EMBED'
          ? Object.values(receiptPreview.components as object)
          : receiptPreview.components,
      ).toHaveLength(mode === 'EMBED' ? 0 : 1)
    },
  )
})

describe('Payment Trigger custom button layouts', () => {
  it('keeps chosen buttons inside their container without appending another row', () => {
    const raw = {
      mode: 'COMPONENTS_V2',
      feature_buttons_layout: 'CUSTOM',
      components_v2: {
        components: [
          {
            type: 17,
            components: [
              { type: 10, content: 'Pay here' },
              {
                type: 1,
                components: [
                  { type: 2, action: 'payment.voucher', label: 'Envelope', style: 3, emoji: '🧧' },
                  { type: 2, style: 5, label: 'Help', url: 'https://example.com' },
                ],
              },
            ],
          },
        ],
      },
    }
    const original = structuredClone(raw)
    const enabled = paymentTriggerPresentationPreview(raw, 'method_selector', true)
    const disabled = paymentTriggerPresentationPreview(raw, 'method_selector', false)
    expect(enabled.components).toHaveLength(1)
    expect(enabled.components).toMatchObject([
      {
        components: [
          { content: 'Pay here' },
          {
            components: [
              {
                label: 'Envelope',
                style: 3,
                disabled: false,
                custom_id: 'fujipp:payment:voucher:1000:123456789012345678',
              },
              { style: 5, url: 'https://example.com' },
            ],
          },
        ],
      },
    ])
    expect(JSON.stringify(enabled.components)).not.toContain('"action"')
    expect(JSON.stringify(disabled.components)).toContain('"disabled":true')
    expect(raw).toEqual(original)
  })
  it('allows a deliberate layout without any payment buttons', () => {
    const raw = {
      mode: 'COMPONENTS_V2',
      feature_buttons_layout: 'CUSTOM',
      components_v2: { components: [{ type: 10, content: 'Body' }] },
    }
    expect(paymentTriggerPresentationPreview(raw, 'method_selector', true).components).toEqual(
      raw.components_v2.components,
    )
  })
})

it.each(['bank_payment', 'wallet_payment'])(
  'v1.1 projects a movable Back inside the %s container without mutating saved designs',
  (slot) => {
    const { config } = paymentTriggerFixture()
    const raw = config.presentations.find((item) => item.key === slot)!.defaultDefinition
    const original = structuredClone(raw)
    const preview = paymentTriggerPresentationPreview(raw, slot, false, '1.1.0')
    expect(preview.components).toHaveLength(1)
    expect(JSON.stringify(preview.components)).toContain('fujipp:payment:back:1000')
    expect(JSON.stringify(preview.components)).not.toContain('response_mode')
    expect(JSON.stringify(preview.components)).not.toContain('"action"')
    expect(raw).toEqual(original)
    expect(
      JSON.stringify(paymentTriggerPresentationPreview(raw, slot, false).components),
    ).not.toContain('payment:back')
  },
)

it.each(['EMBED', 'COMPONENTS_V2'] as const)(
  'previews a label-free Back button with an accessible name in %s',
  (mode) => {
    const raw = {
      mode,
      embed: { title: 'Bank' },
      components: { back_button: { label: 'Return to methods', display_mode: 'EMOJI_ONLY' } },
      components_v2: { components: [{ type: 10, content: 'Bank' }] },
    }
    const original = structuredClone(raw)
    const preview = paymentTriggerPresentationPreview(raw, 'bank_payment', false, '1.1.0')
    const serialized = JSON.stringify(preview)
    expect(serialized).toContain('"label":""')
    expect(serialized).toContain('"aria_label":"Return to methods"')
    expect(serialized).toContain('◀️')
    expect(serialized).not.toContain('display_mode')
    expect(raw).toEqual(original)
  },
)
