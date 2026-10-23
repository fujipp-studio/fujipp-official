import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { fetchSeasonalSettings, normalizeSettings, type SeasonalSettings } from '@/features/seasonal-effects/api'
import { seasonalRefreshInterval, useSeasonalEffectsStore } from '@/stores/seasonalEffects'

vi.mock('@/features/seasonal-effects/api', async (original) => ({
  ...await original<typeof import('@/features/seasonal-effects/api')>(),
  fetchSeasonalSettings: vi.fn<typeof fetchSeasonalSettings>(),
}))
const halloween: SeasonalSettings = { effect: 'HALLOWEEN', updatedAt: '2026-10-23T00:00:00Z' }
const snow: SeasonalSettings = { ...halloween, effect: 'CHRISTMAS' }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-23T00:00:00Z'))
  vi.resetAllMocks()
  setActivePinia(createPinia())
})
afterEach(() => vi.useRealTimers())

it('defaults to off, coalesces pending reads, and refreshes after the interval', async () => {
  let resolve!: (value: SeasonalSettings) => void
  vi.mocked(fetchSeasonalSettings).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const store = useSeasonalEffectsStore()
  expect(store.settings.effect).toBe('NONE')
  const pending = store.refresh()
  const duplicate = store.refresh()
  expect(fetchSeasonalSettings).toHaveBeenCalledTimes(1)
  resolve(halloween)
  await Promise.all([pending, duplicate])
  await store.refresh()
  expect(fetchSeasonalSettings).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(seasonalRefreshInterval)
  vi.mocked(fetchSeasonalSettings).mockResolvedValue(snow)
  await store.refresh()
  expect(store.settings.effect).toBe('CHRISTMAS')
})

it('does not let a slow public read overwrite a newer admin save', async () => {
  let resolve!: (value: SeasonalSettings) => void
  vi.mocked(fetchSeasonalSettings).mockImplementation(() => new Promise(r => { resolve = r }))
  const store = useSeasonalEffectsStore()
  const pending = store.refresh()
  store.accept(snow)
  resolve(halloween)
  await pending
  expect(store.settings).toEqual(snow)
})

it('preserves the last good setting after a network failure and discards aborted reads', async () => {
  const store = useSeasonalEffectsStore()
  vi.mocked(fetchSeasonalSettings).mockRejectedValue(new Error('offline'))
  await store.refresh()
  expect(store.settings.effect).toBe('NONE')
  store.accept(halloween)
  vi.advanceTimersByTime(seasonalRefreshInterval)
  await store.refresh()
  expect(store.settings).toEqual(halloween)
  const controller = new AbortController()
  vi.mocked(fetchSeasonalSettings).mockImplementation(async () => {
    controller.abort()
    return snow
  })
  await store.refresh(controller.signal)
  expect(store.settings).toEqual(halloween)
})

it('fails closed for unrecognized or malformed public settings', () => {
  for (const value of [null, [], 'HALLOWEEN', { effect: 'OTHER' }, { effect: 1 }]) {
    expect(normalizeSettings(value).effect).toBe('NONE')
  }
})
