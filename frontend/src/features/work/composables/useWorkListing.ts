import { useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, ref, type Ref } from 'vue'
import type { WorkLocale, WorkOverview } from '../api'
import { workCatalogQuery } from '../queries'

const emptyOverview: WorkOverview = { total: 0, categories: [], featured: [] }

export function useWorkListing(
  locale: Ref<WorkLocale>,
  category: Ref<string>,
  _pageSize: Ref<number>,
  queryClient?: QueryClient,
) {
  const client = queryClient ?? useQueryClient()
  const options = computed(() => workCatalogQuery(locale.value))
  const result = useQuery(
    computed(() => ({ ...options.value, shallow: true })),
    client,
  )
  const moreError = ref('')
  const loadingMore = ref(false)
  const overview = computed(() => result.data.value?.overview ?? emptyOverview)
  const works = computed(() => {
    const all = result.data.value?.works ?? []
    return category.value === 'all'
      ? all
      : all.filter((work) => work.category.code === category.value)
  })
  const total = computed(() => works.value.length)
  const error = computed(() => (result.data.value ? '' : (result.error.value?.message ?? '')))
  const loading = result.isPending

  async function load(force = false) {
    const current = options.value
    try {
      if (force)
        await client.invalidateQueries({
          queryKey: current.queryKey,
          exact: true,
          refetchType: 'none',
        })
      await client.query(current)
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
