export interface WalletQrWatermark {
  mode: 'NONE' | 'TEXT' | 'LOGO'
  text: string
  logoDataUri: string
}
export const plainWalletQr: WalletQrWatermark = { mode: 'NONE', text: '', logoDataUri: '' }
export function readWalletQrWatermark(value: unknown): WalletQrWatermark | null {
  try {
    const item: unknown = typeof value === 'string' ? JSON.parse(value) : value
    if (item == null) return { ...plainWalletQr }
    if (typeof item !== 'object' || Array.isArray(item)) return null
    const record = item as Record<string, unknown>
    if (!['NONE', 'TEXT', 'LOGO'].includes(String(record.mode))) return null
    const text = record.text === undefined ? '' : record.text,
      logoDataUri = record.logoDataUri === undefined ? '' : record.logoDataUri
    if (typeof text !== 'string' || typeof logoDataUri !== 'string') return null
    return { mode: record.mode as WalletQrWatermark['mode'], text, logoDataUri }
  } catch {
    return null
  }
}
export function walletQrWatermarkValid(value: unknown): boolean {
  const item = readWalletQrWatermark(value)
  return Boolean(
    item &&
    Array.from(item.text).length <= 60 &&
    !Array.from(item.text).some((char) => {
      const code = char.codePointAt(0)!
      return code < 32 || (code >= 127 && code <= 159)
    }) &&
    item.logoDataUri.length <= 60000 &&
    (!item.logoDataUri ||
      /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(item.logoDataUri)) &&
    (item.mode !== 'LOGO' || item.logoDataUri),
  )
}
