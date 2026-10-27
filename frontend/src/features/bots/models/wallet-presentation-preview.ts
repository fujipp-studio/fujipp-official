import { walletActionDefaults } from '../config/feature-editor'

type Definition = Record<string, unknown>
const isRecord = (value: unknown): value is Definition =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const styles: Record<string, number> = { primary: 1, secondary: 2, success: 3, danger: 4 }

function actionButton(action: string, override: Definition = {}): Definition | null {
  const defaults = walletActionDefaults[action]
  if (!defaults) return null
  return {
    type: 2,
    custom_id: `fujipp:wallet:${action.slice('wallet.'.length)}`,
    label: String(override.label ?? defaults.label[1]),
    emoji: String(override.emoji ?? defaults.emoji),
    style: styles[String(override.style).toLowerCase()] ?? styles[defaults.style],
  }
}

function expandActions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expandActions)
  if (!isRecord(value)) return value
  if (typeof value.action === 'string') {
    const button = actionButton(value.action)
    if (button) return button
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandActions(item)]))
}

/** Preview-only conversion matching wallet-topup/v1.0.0.ts render(). Never saved. */
export function normalizeWalletQrMedia(value: unknown, media = false): unknown {
  if (typeof value === 'string')
    return media ? value.replace(/\{\{slip_channel_url}}/g, '{{qr_url}}') : value
  if (Array.isArray(value)) return value.map((item) => normalizeWalletQrMedia(item, media))
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeWalletQrMedia(
          item,
          media || ['image_url', 'thumbnail_url', 'image', 'thumbnail', 'media'].includes(key),
        ),
      ]),
    )
  return value
}

export function walletPresentationPreview(configured: Definition, slotKey = ''): Definition {
  const raw = (
    slotKey === 'promptpay_qr' ? normalizeWalletQrMedia(configured) : configured
  ) as Definition
  if (raw.mode !== 'COMPONENTS_V2') return raw
  // Complete payload overrides take precedence over flat or nested designs.
  if (Array.isArray(raw.components))
    return { mode: 'COMPONENTS_V2', components: expandActions(raw.components) }

  const definition = isRecord(raw.components_v2) ? { ...raw, ...raw.components_v2 } : raw
  const overrides = isRecord(definition.action_overrides) ? definition.action_overrides : {}
  const buttons: Definition[] = []
  if (Array.isArray(definition.actions)) {
    for (const action of definition.actions) {
      if (typeof action !== 'string') continue
      const override = overrides[action]
      const button = actionButton(action, isRecord(override) ? override : {})
      if (button) buttons.push(button)
    }
  }
  if (Array.isArray(definition.links)) {
    for (const link of definition.links) {
      if (!isRecord(link) || !link.url) continue
      buttons.push({
        type: 2,
        style: 5,
        url: String(link.url),
        label: String(link.label ?? 'เปิดลิงก์'),
        emoji: String(link.emoji ?? '🔗'),
      })
    }
  }
  const row = buttons.length ? { type: 1, components: buttons } : null
  if (Array.isArray(definition.components)) {
    return {
      mode: 'COMPONENTS_V2',
      components: [...definition.components.map(expandActions), ...(row ? [row] : [])],
    }
  }
  const children: Definition[] = [
    { type: 10, content: `# ${String(definition.title ?? '')}\n` },
    { type: 14, divider: true, spacing: 2 },
    { type: 10, content: String(definition.description ?? '') },
  ]
  const image = definition.image_url ?? definition.image
  const imageUrl = isRecord(image) ? image.url : image
  if (imageUrl) children.push({ type: 12, items: [{ media: { url: String(imageUrl) } }] })
  if (row) children.push(row)
  return { mode: 'COMPONENTS_V2', components: [{ type: 17, components: children }] }
}
