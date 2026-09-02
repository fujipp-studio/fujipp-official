import type { Session } from '@supabase/supabase-js'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BotSettingsView from '@/features/bots/views/BotSettingsView.vue'
import { fetchBots, fetchFeatureLicenses, type FeatureLicense } from '@/features/bots/api'
import {
  fetchRuntimeSubscriptions,
  renewRuntime,
} from '@/features/bots/runtime-api'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores'
import { bot, license, runtimeSubscription } from './fixtures/domain'

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
    renewRuntime: vi.fn<typeof actual.renewRuntime>(),
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
    HTMLDialogElement.prototype.showModal = vi.fn<() => void>(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    })
    HTMLDialogElement.prototype.close = vi.fn<() => void>(function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    })
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

  it('confirms an active Runtime top-up and shows the extended period before charging', async () => {
    vi.mocked(fetchRuntimeSubscriptions).mockResolvedValue([runtimeSubscription])
    vi.mocked(renewRuntime).mockResolvedValue({
      ...runtimeSubscription,
      currentPeriodEnd: '2026-10-03T00:00:00Z',
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.session = { access_token: 'test-token' } as Session
    auth.initialized = true

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/my-bot/:botId/settings/runtime',
          name: 'bot-runtime-settings',
          component: BotSettingsView,
        },
      ],
    })
    await router.push(`/my-bot/${bot.id}/settings/runtime`)
    await router.isReady()

    const wrapper = mount(BotSettingsView, { global: { plugins: [pinia, router, i18n] } })
    await flushPromises()

    const topUpButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Top up Runtime now'))
    expect(topUpButton).toBeDefined()
    await topUpButton?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Confirm Runtime top-up')
    expect(wrapper.text()).toContain('99.00')
    expect(wrapper.text()).toContain('30 days')
    expect(renewRuntime).not.toHaveBeenCalled()

    const confirmButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Confirm top-up'))
    await confirmButton?.trigger('click')
    await flushPromises()

    expect(renewRuntime).toHaveBeenCalledWith(runtimeSubscription.id, auth.session)
    expect(wrapper.text()).toContain('Oct 3, 2026')
    wrapper.unmount()
  })
})
