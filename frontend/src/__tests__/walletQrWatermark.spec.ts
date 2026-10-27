import { describe, expect, it } from 'vitest'
import {
  readWalletQrWatermark,
  walletQrWatermarkValid,
} from '../features/bots/models/wallet-qr-watermark'
import { prepareWalletQrLogo } from '../features/bots/models/wallet-qr-logo'

describe('Optional Wallet QR watermarks', () => {
  it('keeps older wallets plain and accepts Thai shop text', () => {
    expect(walletQrWatermarkValid(undefined)).toBe(true)
    expect(readWalletQrWatermark(undefined)?.mode).toBe('NONE')
    expect(walletQrWatermarkValid(JSON.stringify({ mode: 'TEXT', text: 'ร้านขนม Kanom' }))).toBe(
      true,
    )
    expect(walletQrWatermarkValid({ mode: 'TEXT', text: '' })).toBe(true)
  })
  it('rejects missing logos, remote URLs, malformed data and oversized text', () => {
    for (const input of [
      'invalid',
      [],
      { mode: 'OTHER' },
      { mode: 'LOGO' },
      { mode: 'TEXT', text: 'x'.repeat(61) },
      { mode: 'TEXT', text: 'line\nline' },
      { mode: 'LOGO', logoDataUri: 'https://example.invalid/logo.png' },
      { mode: 'LOGO', logoDataUri: 'data:image/png;base64,aGVsbG8=' },
    ])
      expect(walletQrWatermarkValid(input)).toBe(false)
  })
  it('rejects unsafe file formats and oversized files before decoding', async () => {
    await expect(
      prepareWalletQrLogo(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })),
    ).rejects.toThrow('Choose a PNG, JPEG or WebP image up to 2 MB.')
    await expect(
      prepareWalletQrLogo(
        new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' }),
      ),
    ).rejects.toThrow('Choose a PNG, JPEG or WebP image up to 2 MB.')
  })
})
