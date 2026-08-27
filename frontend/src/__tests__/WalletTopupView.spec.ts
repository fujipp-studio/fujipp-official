import type { Session } from '@supabase/supabase-js'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WalletTopupView from '../features/topup/views/WalletTopupView.vue'
import { i18n } from '../i18n'
import { useAuthStore } from '../stores'
import { createWalletTopup } from '../services/backend'
import type { WalletTopupInvoice } from '../services/backend'

vi.mock('../services/backend', () => ({
  createWalletTopup: vi.fn<
    (amountSatang: number, session: Session, idempotencyKey?: string) => Promise<WalletTopupInvoice>
  >(),
  fetchWalletTopup: vi.fn<
    (invoiceId: string, session: Session) => Promise<WalletTopupInvoice>
  >(),
  verifyWalletTopupSlip: vi.fn<
    (invoiceId: string, file: File, session: Session) => Promise<WalletTopupInvoice>
  >(),
}))

const pendingInvoice = {
  invoiceId: '11111111-1111-4111-8111-111111111111',
  invoiceNumber: 'TPU_TEST',
  amountSatang: 30000,
  currency: 'THB',
  status: 'PENDING' as const,
  promptPayAccountName: 'Anawat Boripakhirun',
  qrImageUrl: 'https://promptpay.io/test/300.png',
  balanceSatang: 12500,
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  completedAt: null,
}

describe('WalletTopupView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.session = { access_token: 'test-token' } as Session
    auth.currentUser = {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'user@example.com',
      role: 'USER',
      status: 'ACTIVE',
      username: 'user',
      displayName: 'User',
      firstName: null,
      lastName: null,
      avatarUrl: null,
      profileCompletedAt: null,
      walletBalanceSatang: 12500,
    }
    i18n.global.locale.value = 'en'
  })

  it('shows the current balance and amount choices', () => {
    const wrapper = mount(WalletTopupView, { global: { plugins: [i18n] } })

    expect(wrapper.text()).toContain('Current balance')
    expect(wrapper.text()).toContain('125.00')
    expect(wrapper.text()).toContain('฿1,000')
  })

  it('creates an invoice for the selected preset and displays its QR', async () => {
    vi.mocked(createWalletTopup).mockResolvedValue(pendingInvoice)
    const wrapper = mount(WalletTopupView, { global: { plugins: [i18n] } })

    await wrapper.get('.amount-grid button:nth-child(3)').trigger('click')
    await wrapper.get('.topup-panel .app-button').trigger('click')
    await flushPromises()

    expect(createWalletTopup).toHaveBeenCalledWith(
      30000,
      expect.objectContaining({ access_token: 'test-token' }),
      expect.stringMatching(/^web-topup:/),
    )
    expect(wrapper.get('.qr-frame img').attributes('src')).toBe(pendingInvoice.qrImageUrl)
    expect(wrapper.text()).toContain('Anawat Boripakhirun')
    wrapper.unmount()
  })

  it('accepts a custom whole-baht amount', async () => {
    vi.mocked(createWalletTopup).mockResolvedValue({ ...pendingInvoice, amountSatang: 75000 })
    const wrapper = mount(WalletTopupView, { global: { plugins: [i18n] } })

    const amountInput = wrapper.get('input[inputmode="numeric"]')
    await amountInput.setValue('abc750')
    await wrapper.get('.topup-panel .app-button').trigger('click')
    await flushPromises()

    expect((amountInput.element as HTMLInputElement).value).toBe('750')
    expect(createWalletTopup).toHaveBeenCalledWith(
      75000,
      expect.objectContaining({ access_token: 'test-token' }),
      expect.stringMatching(/^web-topup:/),
    )
    wrapper.unmount()
  })
})
