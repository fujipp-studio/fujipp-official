import { paymentTriggerButtonDefaults } from '../config/payment-trigger'

type Definition = Record<string, unknown>
const isRecord = (value: unknown): value is Definition =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const styles: Record<string, number> = { primary: 1, secondary: 2, success: 3, danger: 4 }

/** Preview-only payload matching payment-trigger/v1.0.0.ts. Never changes stored designs. */
export function paymentTriggerPresentationPreview(raw: Definition, slot: string): Definition {
  const configured = isRecord(raw.components) ? raw.components : {}
  const buttons =
    slot === 'method_selector'
      ? Object.entries(paymentTriggerButtonDefaults).map(([key, defaults]) => {
          const item = isRecord(configured[key]) ? configured[key] : {}
          return {
            type: 2,
            custom_id: `fujipp:payment:${key === 'bank_button' ? 'bank' : 'wallet'}:1000`,
            label: String(item.label ?? defaults.label).slice(0, 80),
            emoji: String(item.emoji ?? defaults.emoji).trim(),
            style: styles[String(item.style ?? '').toLowerCase()] ?? styles[defaults.style],
          }
        })
      : []
  if (String(raw.mode ?? 'COMPONENTS_V2').toUpperCase() === 'COMPONENTS_V2') {
    const source = isRecord(raw.components_v2) ? raw.components_v2 : raw
    const blocks = Array.isArray(source.components) ? source.components : []
    return {
      mode: 'COMPONENTS_V2',
      components: [...blocks, ...(buttons.length ? [{ type: 1, components: buttons }] : [])],
    }
  }
  return {
    mode: 'EMBED',
    embed: isRecord(raw.embed) ? raw.embed : raw,
    components: Object.fromEntries(
      buttons.map((button, index) => [index === 0 ? 'bank_button' : 'wallet_button', button]),
    ),
  }
}
