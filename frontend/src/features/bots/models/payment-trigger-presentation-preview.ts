import { paymentTriggerButtonDefaults } from '../config/payment-trigger'
export {
  paymentTriggerPresentationCopy,
  paymentTriggerSampleValues,
} from '../config/payment-trigger'

type Definition = Record<string, unknown>
const isRecord = (value: unknown): value is Definition =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const styles: Record<string, number> = { primary: 1, secondary: 2, success: 3, danger: 4 }
const roles = {
  bank_button: 'payment.bank',
  wallet_button: 'payment.wallet',
  voucher_button: 'payment.voucher',
  back_button: 'payment.back',
}

export function paymentTriggerFeatureButtons(
  raw: Definition,
  slot = 'method_selector',
  version = '1.0.0',
) {
  const navigation = version !== '1.0.0' && Boolean(version)
  if (
    slot !== 'method_selector' &&
    !(navigation && ['bank_payment', 'wallet_payment'].includes(slot))
  )
    return []
  const defaultsByRole =
    slot === 'method_selector'
      ? paymentTriggerButtonDefaults
      : {
          back_button: { label: 'กลับไปเลือกช่องทาง', emoji: '↩️', style: 'secondary' },
        }
  const configured = isRecord(raw.components) ? raw.components : {}
  return Object.entries(defaultsByRole).map(([key, defaults]) => {
    const item = isRecord(configured[key]) ? configured[key] : {}
    const style = Number(item.style)
    const button = {
      type: 2,
      action: roles[key as keyof typeof roles],
      label: String(item.label ?? defaults.label).slice(0, 80),
      emoji: typeof item.emoji === 'string' ? item.emoji.trim() : (item.emoji ?? defaults.emoji),
      ...(navigation
        ? {
            response_mode:
              item.response_mode === 'UPDATE' || item.response_mode === 'NEW_MESSAGE'
                ? item.response_mode
                : key === 'voucher_button'
                  ? 'NEW_MESSAGE'
                  : 'UPDATE',
          }
        : {}),
      style: [1, 2, 3, 4].includes(style)
        ? style
        : (styles[String(item.style ?? '').toLowerCase()] ?? styles[defaults.style]),
    }
    return { value: button.action, label: button.label, button, responseModes: navigation }
  })
}

function hasFeatureButtons(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasFeatureButtons)
  return (
    isRecord(value) &&
    ((typeof value.action === 'string' && value.action.startsWith('payment.')) ||
      Object.values(value).some(hasFeatureButtons))
  )
}

/** Legacy implicit buttons become editable blocks without changing the saved design. */
export function paymentTriggerEditableComponents(
  raw: Definition,
  voucherEnabled: boolean,
  blocks?: Definition[],
  slot = 'method_selector',
  version = '1.0.0',
): Definition[] {
  const source = isRecord(raw.components_v2) ? raw.components_v2 : raw
  const body =
    blocks ?? (Array.isArray(source.components) ? (source.components as Definition[]) : [])
  if (raw.feature_buttons_layout === 'CUSTOM' || hasFeatureButtons(body)) return body
  const buttons = paymentTriggerFeatureButtons(raw, slot, version).filter(
    (item) => item.value !== 'payment.voucher' || voucherEnabled,
  )
  if (!buttons.length) return body
  const row = { type: 1, components: buttons.map((item) => item.button) }
  if (slot !== 'method_selector') {
    const index = body
      .map((block) => block.type === 17 && Array.isArray(block.components))
      .lastIndexOf(true)
    if (index >= 0)
      return body.map((block, i) =>
        i === index
          ? { ...block, components: [...(block.components as Definition[]), row] }
          : block,
      )
  }
  return [...body, row]
}

/** Preview-only resolution mirrors the bot's feature actions and keeps authoring metadata out of payloads. */
export function paymentTriggerPresentationPreview(
  raw: Definition,
  slot: string,
  voucherEnabled = false,
  version = '1.0.0',
): Definition {
  const buttons = paymentTriggerFeatureButtons(raw, slot, version)
  function resolve(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(resolve)
    if (!isRecord(value)) return value
    const choice = buttons.find((item) => item.value === value.action)
    if (choice) {
      const { action: _action, response_mode: _responseMode, ...defaultButton } = choice.button
      const style = Number(value.style)
      return {
        ...defaultButton,
        label: String(value.label ?? defaultButton.label).slice(0, 80),
        emoji:
          typeof value.emoji === 'string'
            ? value.emoji.trim()
            : (value.emoji ?? defaultButton.emoji),
        style: [1, 2, 3, 4].includes(style)
          ? style
          : (styles[String(value.style ?? '').toLowerCase()] ?? defaultButton.style),
        custom_id: `fujipp:payment:${choice.value.slice('payment.'.length)}:1000${choice.value === 'payment.voucher' ? ':123456789012345678' : ''}`,
        disabled:
          value.disabled === true || (choice.value === 'payment.voucher' && !voucherEnabled),
      }
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)]))
  }
  if (String(raw.mode ?? 'COMPONENTS_V2').toUpperCase() === 'COMPONENTS_V2') {
    const source = isRecord(raw.components_v2) ? raw.components_v2 : raw
    const blocks = Array.isArray(source.components) ? (source.components as Definition[]) : []
    return {
      mode: 'COMPONENTS_V2',
      components: resolve(
        paymentTriggerEditableComponents(raw, voucherEnabled, blocks, slot, version),
      ),
    }
  }
  return {
    mode: 'EMBED',
    embed: isRecord(raw.embed) ? raw.embed : raw,
    components: Object.fromEntries(
      buttons.length
        ? buttons
            .filter((item) => item.value !== 'payment.voucher' || voucherEnabled)
            .map((item) => {
              const key = Object.entries(roles).find(([, action]) => action === item.value)![0]
              return [key, resolve(item.button)]
            })
        : [],
    ),
  }
}
