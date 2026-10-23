import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchSeasonalSettings, type SeasonalSettings } from '@/features/seasonal-effects/api'

export const seasonalRefreshInterval = 60_000

export const useSeasonalEffectsStore = defineStore('seasonal-effects', () => {
  const settings = ref<SeasonalSettings>({ effect: 'NONE', updatedAt: '' })
  let lastChecked = 0
  let revision = 0
  let pending: Promise<void> | undefined

  function accept(value: SeasonalSettings) {
    revision++
    settings.value = value
    lastChecked = Date.now()
  }

  function refresh(signal?: AbortSignal) {
    if (pending) return pending
    if (lastChecked && Date.now() - lastChecked < seasonalRefreshInterval) return Promise.resolve()
    const requestRevision = revision
    pending = (async () => {
      try {
        const value = await fetchSeasonalSettings(signal)
        // A slow public read must not replace a newer admin save.
        if (!signal?.aborted && revision === requestRevision) {
          settings.value = value
          lastChecked = Date.now()
        }
      } catch {
        // Decorations never block the page. Retain the last successful value.
      } finally {
        pending = undefined
      }
    })()
    return pending
  }

  return { settings, accept, refresh }
})
