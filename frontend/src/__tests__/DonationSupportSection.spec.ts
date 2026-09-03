import type { Session } from '@supabase/supabase-js'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DonationSupportSection from '@/features/donation/components/DonationSupportSection.vue'
import {
  createDonation,
  fetchDonationCampaign,
  type CreateDonationInput,
  type Donation,
  type DonationCampaign,
} from '@/features/donation/api'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores'

vi.mock('@/features/donation/api', () => ({
  fetchDonationCampaign: vi.fn<() => Promise<DonationCampaign>>(),
  createDonation:
    vi.fn<(input: CreateDonationInput, session: Session) => Promise<Donation>>(),
}))

const campaign: DonationCampaign = {
  title: 'Keep Fujipp building',
  description: 'Support hosting and development.',
  goalSatang: 100_000,
  raisedSatang: 45_000,
  supporterCount: 2,
  leaderboard: [
    {
      rank: 1,
      displayName: 'Top Supporter',
      totalSatang: 30_000,
      donationCount: 2,
      lastDonatedAt: new Date().toISOString(),
    },
  ],
  updatedAt: new Date().toISOString(),
}

const successfulDonation: Donation = {
  donationId: '11111111-1111-4111-8111-111111111111',
  donationNumber: 'DON_TEST',
  donorName: 'Supporter',
  message: '',
  anonymous: false,
  amountSatang: 30_000,
  currency: 'THB',
  fundingMethod: 'WALLET',
  status: 'SUCCESS',
  balanceSatang: 70_000,
  completedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
}

let router: Router

function mountSection() {
  return mount(DonationSupportSection, {
    global: { plugins: [i18n, router] },
  })
}

describe('DonationSupportSection', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(fetchDonationCampaign).mockResolvedValue(campaign)
    vi.mocked(createDonation).mockResolvedValue(successfulDonation)

    HTMLDialogElement.prototype.showModal = vi.fn<() => void>(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute('open', '')
    })
    HTMLDialogElement.prototype.close = vi.fn<() => void>(function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    })

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/about', component: { template: '<div />' } },
        { path: '/add-credit', component: { template: '<div />' } },
      ],
    })
    await router.push('/about')
    await router.isReady()

    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.session = { access_token: 'test-token' } as Session
    auth.currentUser = {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'supporter@example.com',
      role: 'USER',
      status: 'ACTIVE',
      username: 'supporter',
      displayName: 'Supporter',
      firstName: null,
      lastName: null,
      avatarUrl: null,
      profileCompletedAt: null,
      walletBalanceSatang: 100_000,
    }
    vi.spyOn(auth, 'reloadCurrentUser').mockResolvedValue()
    i18n.global.locale.value = 'en'
  })

  it('shows the goal and supporter ranking', async () => {
    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.text()).toContain('Supporter ranking')
    expect(wrapper.text()).toContain('Top Supporter')
    expect(wrapper.get('.goal-track').attributes('aria-valuenow')).toBe('45')
    wrapper.unmount()
  })

  it('donates from the signed-in wallet', async () => {
    const wrapper = mountSection()
    await flushPromises()

    await wrapper.get('.donate-button').trigger('click')
    await flushPromises()
    await wrapper.get('.amount-options button:nth-child(3)').trigger('click')
    await wrapper.get('.modal-action').trigger('click')
    await flushPromises()

    expect(createDonation).toHaveBeenCalledWith(
      expect.objectContaining({
        amountSatang: 30_000,
        donorName: 'Supporter',
        fundingMethod: 'WALLET',
        idempotencyKey: expect.stringMatching(/^web-donation:/),
      }),
      expect.objectContaining({ access_token: 'test-token' }),
    )
    expect(wrapper.text()).toContain('Thank you for your support!')
    wrapper.unmount()
  })

  it('routes to the existing top-up page when the wallet is insufficient', async () => {
    const auth = useAuthStore()
    if (auth.currentUser) auth.currentUser.walletBalanceSatang = 1_000
    const wrapper = mountSection()
    await flushPromises()

    await wrapper.get('.donate-button').trigger('click')
    await flushPromises()
    await wrapper.get('.modal-action').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/add-credit')
    expect(createDonation).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps an anonymous donation tied to the signed-in wallet', async () => {
    const wrapper = mountSection()
    await flushPromises()

    await wrapper.get('.donate-button').trigger('click')
    await flushPromises()
    await wrapper.get('.anonymous-option input').setValue(true)
    await wrapper.get('.modal-action').trigger('click')
    await flushPromises()

    expect(createDonation).toHaveBeenCalledWith(
      expect.objectContaining({ anonymous: true, fundingMethod: 'WALLET' }),
      expect.objectContaining({ access_token: 'test-token' }),
    )
    wrapper.unmount()
  })
})
