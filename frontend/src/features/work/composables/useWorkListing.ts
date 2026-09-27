import { storeToRefs } from 'pinia'
import { computed, ref, type Ref } from 'vue'

import { useWorkStore } from '@/stores'
import type { WorkLocale, WorkOverview } from '../api'

const emptyOverview: WorkOverview = { total: 0, categories: [], featured: [] }

export function useWorkListing(
  locale: Ref<WorkLocale>,
  category: Ref<string>,
  _pageSize: Ref<number>,
) {
  const store = useWorkStore()
  const { entries, loading: loadingEntries, errors } = storeToRefs(store)
  const moreError = ref('')
  const loadingMore = ref(false)

  const currentEntry = computed(() => entries.value[locale.value])
  const overview = computed(() => currentEntry.value?.overview ?? emptyOverview)
  const works = computed(() => {
    const allWorks = currentEntry.value?.works ?? []
    if (category.value === 'all') return allWorks
    return allWorks.filter((work) => work.category.code === category.value)
  })
  const total = computed(() => works.value.length)
  const error = computed(() => errors.value[locale.value] ?? '')
  const loading = computed(
    () => !currentEntry.value && (Boolean(loadingEntries.value[locale.value]) || !error.value),
  )

  async function load(force = false) {
    try {
      await store.load(locale.value, force)
      return true
    } catch {
      return false
    }
  }

  async function ensureVisible(_count: number) {
    return true
  }

  return { works, overview, total, loading, loadingMore, error, moreError, load, ensureVisible }
}
