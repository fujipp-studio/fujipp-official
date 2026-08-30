import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBotSettingsData } from '@/features/bots/composables/useBotSettingsData'
import { controlBot, fetchBots, fetchFeatureLicenses } from '@/features/bots/api'
import { fetchRuntimeSubscriptions } from '@/features/bots/runtime-api'
import { useAuthStore } from '@/stores'
import { bot, license, session, deferred } from './fixtures/domain'
vi.mock('@/features/bots/api', () => ({
  controlBot: vi.fn<typeof import('@/features/bots/api').controlBot>(),
  fetchBots: vi.fn<typeof import('@/features/bots/api').fetchBots>(),
  fetchFeatureLicenses: vi.fn<typeof import('@/features/bots/api').fetchFeatureLicenses>(),
}))
vi.mock('@/features/bots/runtime-api', () => ({
  fetchRuntimeSubscriptions: vi.fn<typeof fetchRuntimeSubscriptions>(),
}))
let scope: EffectScope
const botId = ref(bot.id)
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.session = session
  auth.initialized = true
  vi.mocked(fetchBots).mockResolvedValue([bot])
  vi.mocked(fetchFeatureLicenses).mockResolvedValue([license])
  vi.mocked(fetchRuntimeSubscriptions).mockResolvedValue([])
  botId.value = bot.id
  scope = effectScope()
})
afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})
const create = () => scope.run(() => createBotSettingsData({ botId, adminMode: ref(false) }))!
describe('shared bot settings data', () => {
  it('coalesces concurrent shell/child loads and keeps one status poll', async () => {
    const data = create()
    await Promise.all([data.load(), data.load(), data.load()])
    await data.load()
    expect(fetchBots).toHaveBeenCalledTimes(1)
    expect(fetchFeatureLicenses).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetchBots).toHaveBeenCalledTimes(2)
    expect(fetchFeatureLicenses).toHaveBeenCalledTimes(1)
    scope.stop()
    await vi.advanceTimersByTimeAsync(6000)
    expect(fetchBots).toHaveBeenCalledTimes(2)
  })
  it('exposes failed loads and permits retry', async () => {
    vi.mocked(fetchBots).mockRejectedValueOnce(new Error('Service unavailable'))
    const data = create()
    await data.load()
    expect(data.error.value).toBe('Service unavailable')
    await data.load(true)
    expect(data.error.value).toBe('')
    expect(data.bot.value?.id).toBe(bot.id)
  })
  it('discards stale requests after switching to a different bot', async () => {
    const first = deferred<(typeof bot)[]>()
    vi.mocked(fetchBots).mockReturnValueOnce(first.promise)
    const data = create()
    const original = data.load()
    vi.mocked(fetchBots).mockResolvedValueOnce([{ ...bot, id: 'second-bot' }])
    botId.value = 'second-bot'
    await nextTick()
    await flushPromises()
    first.resolve([bot])
    await original
    expect(data.bot.value?.id).toBe('second-bot')
  })
  it('does not let an old poll overwrite a completed stop action', async () => {
    const data = create()
    await data.load()
    const poll = deferred<(typeof bot)[]>()
    vi.mocked(fetchBots).mockReturnValueOnce(poll.promise)
    await vi.advanceTimersByTimeAsync(3000)
    vi.mocked(controlBot).mockResolvedValueOnce({ ...bot, desiredState: 'STOPPED' })
    await data.runControl('stop')
    poll.resolve([bot])
    await flushPromises()
    expect(data.bot.value?.desiredState).toBe('STOPPED')
  })
  it('pauses polling while the document is hidden', async () => {
    const data = create()
    await data.load()
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    await vi.advanceTimersByTimeAsync(6000)
    expect(fetchBots).toHaveBeenCalledTimes(1)
  })
  it('keeps a saved bot update when an older poll finishes later', async () => {
    const data = create()
    await data.load()
    const poll = deferred<(typeof bot)[]>()
    vi.mocked(fetchBots).mockReturnValueOnce(poll.promise)
    await vi.advanceTimersByTimeAsync(3000)
    data.setBot({ ...bot, name: 'Renamed bot' })
    poll.resolve([bot])
    await flushPromises()
    expect(data.bot.value?.name).toBe('Renamed bot')
  })
})
