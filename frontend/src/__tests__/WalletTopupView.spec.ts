import type { Session } from '@supabase/supabase-js'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import WalletTopupView from '../features/topup/views/WalletTopupView.vue'
import { i18n } from '../i18n'
import { useAuthStore } from '../stores'
import {
  createWalletTopup,
  fetchWalletTopup,
  listWalletTopups,
  verifyWalletTopupSlip,
} from '@/features/topup/api'
import { type CursorPage } from '@/shared/api/http'
import { type WalletTopupInvoice, type WalletTopupSummary } from '@/features/topup/api'

vi.mock('@/features/topup/api', () => ({
  createWalletTopup:
    vi.fn<
      (
        amountSatang: number,
        session: Session,
        idempotencyKey?: string,
      ) => Promise<WalletTopupInvoice>
    >(),
  fetchWalletTopup: vi.fn<(invoiceId: string, session: Session) => Promise<WalletTopupInvoice>>(),
  verifyWalletTopupSlip:
    vi.fn<(invoiceId: string, file: File, session: Session) => Promise<WalletTopupInvoice>>(),
  listWalletTopups: vi
    .fn<
      (
        session: Session,
        cursor?: string | null,
        limit?: number,
      ) => Promise<CursorPage<WalletTopupSummary>>
    >()
    .mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
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
  createdAt: new Date().toISOString(),
}
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollIntoView',
)

describe('WalletTopupView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listWalletTopups).mockResolvedValue({ items: [], nextCursor: null, hasMore: false })
    vi.stubGlobal('scrollTo', vi.fn<typeof window.scrollTo>())
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: vi.fn<typeof HTMLElement.prototype.scrollIntoView>(),
      configurable: true,
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-slip')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
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

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalScrollIntoView)
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  })

  it('keeps the skin based on the actual balance when a top-up amount is selected', async () => {
    const wrapper = mount(WalletTopupView, { global: { plugins: [i18n] } })
    expect(wrapper.get('.balance-card').attributes('data-wallet-skin')).toBe('green')
    await wrapper.get('.amount-grid button:last-child').trigger('click')
    expect(wrapper.get('.balance-card').attributes('data-wallet-skin')).toBe('green')
    useAuthStore().currentUser!.walletBalanceSatang = 100000
    await flushPromises()
    expect(wrapper.get('.balance-card').attributes('data-wallet-skin')).toBe('emerald')
    wrapper.unmount()
  })

  it('shows the current balance and amount choices', () => {
    const wrapper = mount(WalletTopupView, { global: { plugins: [i18n] } })

    expect(wrapper.text()).toContain('Current balance')
    expect(wrapper.text()).toContain('125.00')
    expect(wrapper.text()).toContain('฿1,000')
    wrapper.unmount()
  })

  it('creates an invoice for the selected preset and displays its QR', async () => {
    vi.mocked(createWalletTopup).mockResolvedValue(pendingInvoice)
    const wrapper = mount(WalletTopupView, { global: { plugins: [i18n] } })

    await wrapper.get('.amount-grid button:nth-child(3)').trigger('click')
    await wrapper.get('.continue-button').trigger('click')
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
    await wrapper.get('.continue-button').trigger('click')
    await flushPromises()

    expect((amountInput.element as HTMLInputElement).value).toBe('750')
    expect(createWalletTopup).toHaveBeenCalledWith(
      75000,
      expect.objectContaining({ access_token: 'test-token' }),
      expect.stringMatching(/^web-topup:/),
    )
    wrapper.unmount()
  })

  it('loads an unfinished invoice and lets the user continue it', async () => {
    vi.mocked(listWalletTopups).mockResolvedValue({
      items: [pendingInvoice],
      nextCursor: null,
      hasMore: false,
    })
    const wrapper = mount(WalletTopupView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Top-up history')
    vi.mocked(fetchWalletTopup).mockResolvedValue(pendingInvoice)
    await wrapper.get('.resume-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.qr-frame img').attributes('src')).toBe(pendingInvoice.qrImageUrl)
    wrapper.unmount()
  })

  it('blocks out-of-range amounts and restores the preset selection', async () => {
    const wrapper = mount(WalletTopupView, { global: { plugins: [i18n] } })
    const input = wrapper.get('input[inputmode="numeric"]')
    const button = wrapper.get('.continue-button')
    for (const value of ['9', '100001']) {
      await input.setValue(value)
      expect(input.attributes('aria-invalid')).toBe('true')
      expect(button.attributes('disabled')).toBeDefined()
      expect(wrapper.get('[data-topup-total]').text()).toBe('—')
      await button.trigger('click')
      expect(createWalletTopup).not.toHaveBeenCalled()
    }
    await wrapper.get('.amount-grid button:nth-child(3)').trigger('click')
    expect(input.element).toHaveProperty('value', '')
    expect(wrapper.get('.amount-grid button:nth-child(3)').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-topup-total]').text()).toContain('300.00')
    expect(wrapper.get('.summary-card').text()).toContain('425.00')
    expect(button.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('rejects unsupported and oversized slips and lets the user remove and reselect an image', async () => {
    vi.mocked(createWalletTopup).mockResolvedValue(pendingInvoice)
    const wrapper = mount(WalletTopupView, { global: { plugins: [i18n] } })
    await wrapper.get('.continue-button').trigger('click')
    await flushPromises()
    const input = wrapper.get('input[type="file"]')
    const pick = async (file: File) => {
      Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
      await input.trigger('change')
    }
    await pick(new File(['text'], 'slip.txt', { type: 'text/plain' }))
    expect(wrapper.get('#topup-slip-error').text()).toContain('Choose a JPG')
    expect(wrapper.get('.slip-panel .app-button').attributes('disabled')).toBeDefined()
    await pick(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))
    expect(wrapper.get('#topup-slip-error').text()).toContain('too large')
    const image = new File(['image'], 'slip.png', { type: 'image/png' })
    await pick(image)
    expect(wrapper.find('#topup-slip-error').exists()).toBe(false)
    expect(wrapper.get('.slip-selected').text()).toContain('slip.png')
    await wrapper.get('.slip-remove').trigger('click')
    expect(wrapper.find('.slip-selected').exists()).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-slip')
    await pick(image)
    expect(wrapper.get('.slip-drop img').attributes('src')).toBe('blob:test-slip')
    wrapper.unmount()
  })

  it('retains the slip after verification fails and updates the receipt after retry', async () => {
    const auth = useAuthStore()
    vi.spyOn(auth, 'reloadCurrentUser').mockResolvedValue()
    vi.mocked(createWalletTopup).mockResolvedValue(pendingInvoice)
    vi.mocked(fetchWalletTopup).mockResolvedValue(pendingInvoice)
    vi.mocked(verifyWalletTopupSlip)
      .mockRejectedValueOnce(new Error('Slip not found'))
      .mockResolvedValueOnce({ ...pendingInvoice, status: 'SUCCESS', balanceSatang: 42500 })
    const wrapper = mount(WalletTopupView, { global: { plugins: [i18n] } })
    await wrapper.get('.continue-button').trigger('click')
    await flushPromises()
    const file = new File(['image'], 'slip.png', { type: 'image/png' })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await wrapper.get('.slip-panel > .app-button').trigger('click')
    await flushPromises()
    expect(wrapper.get('#topup-slip-error').text()).toBe('Slip not found')
    expect(wrapper.get('.slip-selected').text()).toContain('slip.png')
    vi.mocked(listWalletTopups).mockResolvedValue({
      items: [{ ...pendingInvoice, status: 'SUCCESS' }],
      nextCursor: null,
      hasMore: false,
    })
    await wrapper.get('.slip-panel > .app-button').trigger('click')
    await flushPromises()
    expect(verifyWalletTopupSlip).toHaveBeenLastCalledWith(
      pendingInvoice.invoiceId,
      file,
      auth.session,
    )
    expect(auth.reloadCurrentUser).toHaveBeenCalledOnce()
    expect(wrapper.get('.success-balance').text()).toContain('425.00')
    expect(wrapper.get('.topup-steps [aria-current="step"]').text()).toContain('Complete')
    expect(wrapper.get('.history-status').attributes('data-status')).toBe('SUCCESS')
    wrapper.unmount()
  })

  it('disables expired payments and returns to amount selection', async () => {
    vi.mocked(createWalletTopup).mockResolvedValue({ ...pendingInvoice, status: 'EXPIRED' })
    const wrapper = mount(WalletTopupView, { global: { plugins: [i18n] } })
    await wrapper.get('.continue-button').trigger('click')
    await flushPromises()
    expect(wrapper.get('input[type="file"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.slip-panel > .app-button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.qr-expired').text()).toContain('expired')
    await wrapper.get('.qr-panel .app-button').trigger('click')
    expect(wrapper.find('.amount-grid').exists()).toBe(true)
    expect(wrapper.find('.qr-frame').exists()).toBe(false)
    wrapper.unmount()
  })
})
