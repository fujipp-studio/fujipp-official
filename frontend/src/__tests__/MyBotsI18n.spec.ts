import type { Session } from '@supabase/supabase-js'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import MyBotsView from '@/features/bots/views/MyBotsView.vue'
import { fetchBots, fetchFeatureLicenses } from '@/features/bots/api'
import { fetchRuntimeSubscriptions, type RuntimeSubscription } from '@/features/bots/runtime-api'
import { messages } from '@/i18n/messages'
import { useAuthStore } from '@/stores'
import { bot } from './fixtures/domain'

const runtimeSubscription: RuntimeSubscription = {
  id: 'runtime-1',
  slotNumber: 1,
  planId: 'plan-1',
  planName: 'Runtime 1 Month',
  durationDays: 30,
  priceSatang: 9900,
  renewalPriceSatang: null,
  effectiveRenewalPriceSatang: 9900,
  currency: 'THB',
  botId: null,
  botName: null,
  status: 'ACTIVE',
  autoRenew: true,
  currentPeriodEnd: '2026-10-02T10:55:00Z',
  graceUntil: null,
}

vi.mock('@/features/bots/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/bots/api')>()
  return {
    ...actual,
    fetchBots: vi.fn<typeof actual.fetchBots>(),
    fetchFeatureLicenses: vi.fn<typeof actual.fetchFeatureLicenses>(),
    syncBotDiscordProfile: vi.fn<typeof actual.syncBotDiscordProfile>(),
  }
})

vi.mock('@/features/bots/runtime-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/bots/runtime-api')>()
  return {
    ...actual,
    fetchRuntimeSubscriptions: vi.fn<typeof actual.fetchRuntimeSubscriptions>(),
  }
})

describe('My Bot language switching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchBots).mockResolvedValue([{ ...bot, discordAvatarUrl: '/bot-avatar.png' }])
    vi.mocked(fetchFeatureLicenses).mockResolvedValue([])
    vi.mocked(fetchRuntimeSubscriptions).mockResolvedValue([runtimeSubscription])
  })

  it('updates the whole page when switching between English and Thai', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.session = { access_token: 'test-token' } as Session
    auth.initialized = true

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/my-bot', name: 'my-bot', component: { template: '<div />' } },
        { path: '/store', name: 'store', component: { template: '<div />' } },
        {
          path: '/my-bot/:botId/settings',
          name: 'bot-settings',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push('/my-bot')
    await router.isReady()

    const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages })
    const wrapper = mount(MyBotsView, { global: { plugins: [pinia, router, i18n] } })
    await flushPromises()

    expect(wrapper.get('#my-bot-title').text()).toBe('My Bot')
    expect(wrapper.text()).toContain('Add bot')
    expect(wrapper.text()).toContain('Online')
    expect(wrapper.text()).toContain('Running')
    expect(wrapper.text()).toContain('Purchases')
    expect(wrapper.text()).toContain('No Packages found')
    expect(wrapper.text()).toContain('SLOT-1 · Runtime 1 month')
    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('Renewal ฿99')
    expect(wrapper.text()).toContain('Select bot')
    expect(wrapper.text()).toContain('Automatic renewal')

    i18n.global.locale.value = 'th'
    await nextTick()

    expect(wrapper.get('#my-bot-title').text()).toBe('บอทของฉัน')
    expect(wrapper.text()).toContain('เพิ่มบอท')
    expect(wrapper.text()).toContain('ออนไลน์')
    expect(wrapper.text()).toContain('กำลังทำงาน')
    expect(wrapper.text()).toContain('รายการที่ซื้อ')
    expect(wrapper.text()).toContain('ไม่พบแพ็กเกจ')
    expect(wrapper.text()).toContain('ช่อง-1 · รันไทม์ 1 เดือน')
    expect(wrapper.text()).toContain('ใช้งานอยู่')
    expect(wrapper.text()).toContain('ค่าต่ออายุ ฿99')
    expect(wrapper.text()).toContain('เลือกบอท')
    expect(wrapper.text()).toContain('ต่ออายุอัตโนมัติ')

    wrapper.unmount()
  })
})
