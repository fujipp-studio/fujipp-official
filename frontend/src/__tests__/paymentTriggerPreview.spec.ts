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
})
