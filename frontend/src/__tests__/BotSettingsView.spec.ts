import type { Session } from '@supabase/supabase-js'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BotSettingsView from '@/features/bots/views/BotSettingsView.vue'
import { fetchBots, fetchFeatureLicenses, type FeatureLicense } from '@/features/bots/api'
import { fetchRuntimeSubscriptions } from '@/features/bots/runtime-api'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores'
import { bot, license } from './fixtures/domain'

vi.mock('@/features/bots/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/bots/api')>()
  return {
    ...actual,
    fetchBots: vi.fn<typeof actual.fetchBots>(),
    fetchFeatureLicenses: vi.fn<typeof actual.fetchFeatureLicenses>(),
  }
})

vi.mock('@/features/bots/runtime-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/bots/runtime-api')>()
  return {
    ...actual,
    fetchRuntimeSubscriptions: vi.fn<typeof actual.fetchRuntimeSubscriptions>(),
  }
})

const runtimeAlertLicense: FeatureLicense = {
  ...license,
  id: 'runtime-alert-license',
  featureProductId: 'runtime-alert-product',
  featureCode: 'runtime-expiry-alert',
  featureName: 'Runtime Expiry Alert',
}

describe('Bot package settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchBots).mockResolvedValue([bot])
    vi.mocked(fetchFeatureLicenses).mockResolvedValue([runtimeAlertLicense])
    vi.mocked(fetchRuntimeSubscriptions).mockResolvedValue([])
  })

  it('keeps Runtime Expiry Alert visible and configurable in the feature list', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.session = { access_token: 'test-token' } as Session
    auth.initialized = true

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/my-bot/:botId/settings/packages',
          name: 'bot-package-settings',
          component: BotSettingsView,
        },
        {
          path: '/my-bot/:botId/settings/packages/:licenseId',
          name: 'bot-feature-settings',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push(`/my-bot/${bot.id}/settings/packages`)
    await router.isReady()

    const wrapper = mount(BotSettingsView, { global: { plugins: [pinia, router, i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Runtime Expiry Alert')
    const settingsButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Settings'))
    expect(settingsButton).toBeDefined()
    await settingsButton?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('bot-feature-settings')
    expect(router.currentRoute.value.params.licenseId).toBe(runtimeAlertLicense.id)
    wrapper.unmount()
  })
})
