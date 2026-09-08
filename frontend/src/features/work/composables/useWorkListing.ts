import { computed, onScopeDispose, ref, shallowRef, type Ref } from 'vue'
import {
  fetchWorkOverview,
  fetchWorksPage,
  type WorkLocale,
  type WorkOverview,
  type WorkSummary,
} from '../api'

export function useWorkListing(
  locale: Ref<WorkLocale>,
  category: Ref<string>,
  pageSize: Ref<number>,
) {
  const works = shallowRef<WorkSummary[]>([])
  const overview = shallowRef<WorkOverview>({ total: 0, categories: [], featured: [] })
  const loading = ref(true)
  const loadingMore = ref(false)
  const error = ref('')
  const moreError = ref('')
  const nextCursor = ref<string | null>(null)
  const hasMore = ref(false)
  const total = computed(() =>
    category.value === 'all'
      ? overview.value.total
      : (overview.value.categories.find((item) => item.code === category.value)?.total ?? 0),
  )
  let controller: AbortController | undefined
  let generation = 0
  let disposed = false
  const visited = new Set<string>()

  async function load() {
    if (disposed) return false
    controller?.abort()
    const request = new AbortController()
    controller = request
    const version = ++generation
    loading.value = true
    loadingMore.value = false
    error.value = ''
    moreError.value = ''
    visited.clear()
    try {
      const [metadata, page] = await Promise.all([
        fetchWorkOverview(locale.value, request.signal),
        fetchWorksPage(locale.value, {
          category: category.value,
          limit: pageSize.value,
          signal: request.signal,
        }),
      ])
      if (disposed || version !== generation || request.signal.aborted) return false
      overview.value = metadata
      works.value = page.items
      nextCursor.value = page.nextCursor
      hasMore.value = page.hasMore
      if (page.nextCursor) visited.add(page.nextCursor)
    } catch (cause) {
      if (!disposed && version === generation && !request.signal.aborted)
        error.value = cause instanceof Error ? cause.message : 'Unable to load portfolio projects.'
    } finally {
      if (version === generation && !disposed) loading.value = false
    }
    return !disposed && version === generation && !request.signal.aborted
  }

  async function ensureVisible(count: number) {
    if (disposed || loading.value || loadingMore.value) return false
    if (!hasMore.value || works.value.length >= count) return true
    const version = generation
    const signal = controller?.signal
    loadingMore.value = true
    moreError.value = ''
    try {
      while (works.value.length < count && hasMore.value) {
        const cursor = nextCursor.value
        const page = await fetchWorksPage(locale.value, {
          category: category.value,
          cursor,
          limit: Math.min(100, count - works.value.length),
          signal,
        })
        if (disposed || version !== generation || signal?.aborted) return false
        if (page.hasMore && (!page.nextCursor || visited.has(page.nextCursor)))
          throw new Error('The server returned an invalid cursor.')
        const known = new Set(works.value.map((item) => item.slug))
        works.value = [
          ...works.value,
          ...page.items.filter((item) => {
            if (known.has(item.slug)) return false
            known.add(item.slug)
            return true
          }),
        ]
        nextCursor.value = page.nextCursor
        hasMore.value = page.hasMore
        if (page.nextCursor) visited.add(page.nextCursor)
      }
    } catch (cause) {
      if (!disposed && version === generation && !signal?.aborted)
        moreError.value =
          cause instanceof Error ? cause.message : 'Unable to load portfolio projects.'
    } finally {
      if (!disposed && version === generation) loadingMore.value = false
    }
    return !disposed && version === generation && !signal?.aborted
  }

  onScopeDispose(() => {
    disposed = true
    generation += 1
    controller?.abort()
  })
  return { works, overview, total, loading, loadingMore, error, moreError, load, ensureVisible }
}
