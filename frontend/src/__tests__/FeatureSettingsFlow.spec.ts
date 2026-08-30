import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeatureSettings } from '@/features/bots/composables/useFeatureSettings'
import {
  fetchFeatureConfiguration,
  fetchFeatureLicenses,
  fetchBots,
  updateFeatureConfiguration,
} from '@/features/bots/api'
import { fetchRuntimeSubscriptions } from '@/features/bots/runtime-api'
import { useAuthStore } from '@/stores'
import { i18n } from '@/i18n'
import { bot, license, configuration, session, user } from './fixtures/domain'
vi.mock('@/features/bots/api', () => ({
  controlBot: vi.fn<typeof import('@/features/bots/api').controlBot>(),
  fetchBots: vi.fn<typeof import('@/features/bots/api').fetchBots>(),
  fetchFeatureLicenses: vi.fn<typeof import('@/features/bots/api').fetchFeatureLicenses>(),
  fetchFeatureConfiguration:
    vi.fn<typeof import('@/features/bots/api').fetchFeatureConfiguration>(),
  updateFeatureConfiguration:
    vi.fn<typeof import('@/features/bots/api').updateFeatureConfiguration>(),
}))
vi.mock('@/features/bots/runtime-api', () => ({
  fetchRuntimeSubscriptions: vi.fn<typeof fetchRuntimeSubscriptions>(),
}))
beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.session = session
  auth.currentUser = user
  auth.initialized = true
  vi.mocked(fetchBots).mockResolvedValue([bot])
  vi.mocked(fetchFeatureLicenses).mockResolvedValue([license])
  vi.mocked(fetchRuntimeSubscriptions).mockResolvedValue([])
  vi.mocked(fetchFeatureConfiguration).mockResolvedValue(structuredClone(configuration))
  vi.mocked(updateFeatureConfiguration).mockResolvedValue({
    ...structuredClone(configuration),
    revision: 2,
  })
})
async function setup() {
  let editor!: ReturnType<typeof useFeatureSettings>
  const Harness = defineComponent({
    setup() {
      editor = useFeatureSettings()
      return () => h('div')
    },
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/my-bot/:botId/settings/packages/:licenseId',
        name: 'bot-feature-settings',
        component: Harness,
      },
    ],
  })
  await router.push(`/my-bot/${bot.id}/settings/packages/${license.id}`)
  const wrapper = mount(Harness, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return { editor, wrapper }
}
describe('feature settings save flow', () => {
  it('converts field values, omits unchanged secrets and keeps the server revision', async () => {
    const { editor, wrapper } = await setup()
    editor.values.value.MIN_TOPUP_SATANG = '250'
    expect(await editor.save()).toBe(true)
    expect(updateFeatureConfiguration).toHaveBeenCalledWith(
      license.id,
      expect.objectContaining({ values: { MIN_TOPUP_SATANG: 250 }, secrets: {} }),
      expect.objectContaining({ access_token: session.access_token }),
    )
    expect(editor.configuration.value?.revision).toBe(2)
    wrapper.unmount()
  })
  it('keeps edits available for retry after a failed save', async () => {
    const { editor, wrapper } = await setup()
    editor.values.value.MIN_TOPUP_SATANG = '300'
    vi.mocked(updateFeatureConfiguration).mockRejectedValueOnce(new Error('Service unavailable'))
    expect(await editor.save()).toBe(false)
    expect(editor.values.value.MIN_TOPUP_SATANG).toBe('300')
    expect(editor.toastMessage.value).toBe('Service unavailable')
    expect(editor.saving.value).toBe(false)
    wrapper.unmount()
  })
  it('does not send invalid presentation JSON to the API', async () => {
    const { editor, wrapper } = await setup()
    editor.advancedSlots.value.add('panel')
    editor.presentationJson.value.panel = '{invalid'
    expect(await editor.save()).toBe(false)
    expect(updateFeatureConfiguration).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
