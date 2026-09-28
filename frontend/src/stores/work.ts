import { defineStore } from 'pinia'
import { ref } from 'vue'

import {
  fetchWorkOverview,
  fetchWorksPage,
  invalidateWorkListingCache,
  type WorkLocale,
  type WorkOverview,
  type WorkSummary,
} from '@/features/work/api'

interface WorkSessionData {
  overview: WorkOverview
  works: WorkSummary[]
}

const requests = new Map<WorkLocale, Promise<WorkSessionData>>()

export const useWorkStore = defineStore('work', () => {
  const entries = ref<Partial<Record<WorkLocale, WorkSessionData>>>({})
  const loading = ref<Partial<Record<WorkLocale, boolean>>>({})
  const errors = ref<Partial<Record<WorkLocale, string>>>({})

  function load(locale: WorkLocale, force = false): Promise<WorkSessionData> {
    const cached = entries.value[locale]
    if (cached && !force) return Promise.resolve(cached)

    const pending = requests.get(locale)
    if (pending && !force) return pending
    if (force) invalidateWorkListingCache()

    loading.value = { ...loading.value, [locale]: true }
    errors.value = { ...errors.value, [locale]: '' }

    const request = loadAllWork(locale)
      .then((data) => {
        entries.value = { ...entries.value, [locale]: data }
        return data
      })
      .catch((cause: unknown) => {
        errors.value = {
          ...errors.value,
          [locale]: cause instanceof Error ? cause.message : 'Unable to load portfolio projects.',
        }
        throw cause
      })
      .finally(() => {
        loading.value = { ...loading.value, [locale]: false }
        if (requests.get(locale) === request) requests.delete(locale)
      })

    requests.set(locale, request)
    return request
  }

  return { entries, loading, errors, load }
})

async function loadAllWork(locale: WorkLocale): Promise<WorkSessionData> {
  const [overview, firstPage] = await Promise.all([
    fetchWorkOverview(locale),
    fetchWorksPage(locale, { limit: 100 }),
  ])
  const works = [...firstPage.items]
  const known = new Set(works.map((work) => work.slug))
  let cursor = firstPage.nextCursor
  let hasMore = firstPage.hasMore
  const visited = new Set<string>()

  while (hasMore) {
    if (!cursor || visited.has(cursor)) throw new Error('The server returned an invalid cursor.')
    visited.add(cursor)
    const page = await fetchWorksPage(locale, { cursor, limit: 100 })
    for (const work of page.items) {
      if (known.has(work.slug)) continue
      known.add(work.slug)
      works.push(work)
    }
    cursor = page.nextCursor
    hasMore = page.hasMore
  }

  return { overview, works }
}
