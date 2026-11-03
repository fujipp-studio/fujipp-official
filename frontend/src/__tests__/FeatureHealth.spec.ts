import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import FeatureHealthPanel from '@/features/bots/feature-health/FeatureHealthPanel.vue'
import {
  fetchFeatureHealth,
  retryFeature,
  type FeatureHealth,
} from '@/features/bots/feature-health/api'
import { useAuthStore } from '@/stores'
import { i18n } from '@/i18n'
import { session } from './fixtures/domain'

vi.mock('@/features/bots/feature-health/api', () => ({
  fetchFeatureHealth:
    vi.fn<typeof import('@/features/bots/feature-health/api').fetchFeatureHealth>(),
  retryFeature: vi.fn<typeof import('@/features/bots/feature-health/api').retryFeature>(),
}))
const issue: FeatureHealth = {
  installationId: 'install-1',
  licenseId: 'license-1',
  featureCode: 'price-reader',
  featureName: 'Price Reader',
  version: '3.0.0',
  status: 'ERROR',
  errorCategory: 'CONFIGURATION',
  errorCode: 'FEATURE_ACTIVATION_FAILED',
  errorMessage: 'READER_CHANNEL_ID is required',
  hint: 'แก้การตั้งค่า',
  lastErrorAt: '2026-11-02T00:00:00Z',
  recoveryAttempts: 0,
  nextRetryAt: null,
  canRetry: true,
}
const mounted: ReturnType<typeof mount>[] = []
beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  useAuthStore().session = session
  i18n.global.locale.value = 'en'
  vi.mocked(fetchFeatureHealth).mockResolvedValue([issue])
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(() => {
  mounted.splice(0).forEach((view) => view.unmount())
})
function view() {
  const wrapper = mount(FeatureHealthPanel, {
    props: { botId: 'bot-1', admin: false },
    global: { plugins: [i18n] },
  })
  mounted.push(wrapper)
  return wrapper
}
describe('Feature health', () => {
  it('shows actionable diagnostics and requires confirmation before retry', async () => {
    const wrapper = view()
    await flushPromises()
    expect(wrapper.text()).toContain('Needs configuration')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Configure')!
      .trigger('click')
    expect(wrapper.emitted('configure')?.[0]).toEqual(['license-1'])
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Check and restart')!
      .trigger('click')
    await flushPromises()
    expect(retryFeature).not.toHaveBeenCalled()
    vi.mocked(retryFeature).mockRejectedValueOnce(new Error('Missing Discord permissions'))
    await wrapper
      .find('dialog')
      .findAll('button')
      .find((button) => button.text() === 'Check and restart')!
      .trigger('click')
    await flushPromises()
    expect(retryFeature).toHaveBeenCalledWith(
      'bot-1',
      'install-1',
      false,
      session,
      expect.any(AbortSignal),
    )
    expect(wrapper.find('dialog').text()).toContain('Missing Discord permissions')
  })
  it('ignores stale results after switching bot and aborts its previous request', async () => {
    let resolve!: (rows: FeatureHealth[]) => void
    vi.mocked(fetchFeatureHealth).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const wrapper = view()
    const signal = vi.mocked(fetchFeatureHealth).mock.calls[0]![3]
    vi.mocked(fetchFeatureHealth).mockResolvedValueOnce([])
    await wrapper.setProps({ botId: 'bot-2', admin: true })
    await flushPromises()
    expect(signal.aborted).toBe(true)
    resolve([issue])
    await flushPromises()
    expect(wrapper.text()).not.toContain('Price Reader')
    expect(fetchFeatureHealth).toHaveBeenLastCalledWith(
      'bot-2',
      true,
      session,
      expect.any(AbortSignal),
    )
  })
  it('keeps deliberately disabled features out of the issue count', async () => {
    vi.mocked(fetchFeatureHealth).mockResolvedValueOnce([
      {
        ...issue,
        status: 'DISABLED',
        errorCode: null,
        errorMessage: null,
        errorCategory: null,
        canRetry: false,
      },
    ])
    const wrapper = view()
    await flushPromises()
    expect(wrapper.text()).toContain('1 disabled')
    expect(wrapper.text()).not.toContain('need attention')
    expect(wrapper.findAll('article')).toHaveLength(0)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Show all')!
      .trigger('click')
    expect(wrapper.findAll('article')).toHaveLength(1)
  })
  it('does not render retry controls for an operation error', async () => {
    vi.mocked(fetchFeatureHealth).mockResolvedValueOnce([
      { ...issue, errorCode: 'PAYMENT_FAILED', canRetry: false },
    ])
    const wrapper = view()
    await flushPromises()
    expect(wrapper.findAll('button').some((button) => button.text() === 'Check and restart')).toBe(
      false,
    )
  })
})
