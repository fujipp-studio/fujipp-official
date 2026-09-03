import type { Session } from '@supabase/supabase-js'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { updateDonationSettings } from '@/features/admin/api/donations'
import AdminDonationsView from '@/features/admin/views/AdminDonationsView.vue'
import {
  fetchDonationCampaign,
  type DonationCampaign,
} from '@/features/donation/api'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores'

vi.mock('@/features/admin/api/donations', () => ({
  updateDonationSettings:
    vi.fn<
      (
        input: { title: string; description: string; goalSatang: number },
        session: Session,
      ) => Promise<DonationCampaign>
    >(),
}))
vi.mock('@/features/donation/api', () => ({
  fetchDonationCampaign: vi.fn<() => Promise<DonationCampaign>>(),
}))

const campaign: DonationCampaign = {
  title: 'Keep Fujipp building',
  description: 'Support hosting and development.',
  goalSatang: 1_000_000,
  raisedSatang: 450_000,
  supporterCount: 8,
  leaderboard: [
    {
      rank: 1,
      displayName: 'Top Supporter',
      totalSatang: 300_000,
      donationCount: 3,
      lastDonatedAt: new Date().toISOString(),
    },
  ],
  updatedAt: new Date().toISOString(),
}

describe('AdminDonationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchDonationCampaign).mockResolvedValue(campaign)
    vi.mocked(updateDonationSettings).mockResolvedValue({
      ...campaign,
      goalSatang: 2_500_000,
    })

    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().session = { access_token: 'admin-token' } as Session
    i18n.global.locale.value = 'en'
  })

  it('loads the campaign and lets an admin update its goal', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin', component: { template: '<div />' } },
        { path: '/admin/donations', component: AdminDonationsView },
      ],
    })
    await router.push('/admin/donations')
    await router.isReady()

    const wrapper = mount(AdminDonationsView, {
      global: { plugins: [i18n, router] },
    })
    await flushPromises()

    expect((wrapper.get('input[type="text"]').element as HTMLInputElement).value).toBe(
      'Keep Fujipp building',
    )
    expect(wrapper.text()).toContain('Top Supporter')

    await wrapper.get('input[type="number"]').setValue('25000')
    await wrapper.get('.donation-settings-form').trigger('submit')
    await flushPromises()

    expect(updateDonationSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Keep Fujipp building',
        goalSatang: 2_500_000,
      }),
      expect.objectContaining({ access_token: 'admin-token' }),
    )
    wrapper.unmount()
  })
})
