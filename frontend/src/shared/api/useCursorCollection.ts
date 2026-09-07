import { nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { CursorPage } from './http'

/** Preserve the existing scroll surface while requesting one page at a time. */
export function useCursorCollection<T>(
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<CursorPage<T>>,
  itemKey: (item: T) => string,
) {
  const items = shallowRef<T[]>([])
  const loading = ref(false)
  const error = ref('')
  const sentinel = ref<HTMLElement>()
  const hasMore = ref(false)
  let nextCursor: string | null = null
  let controller: AbortController | undefined
  let observer: IntersectionObserver | undefined
  let generation = 0
  let disposed = false
  const visited = new Set<string>()

  function observe() {
    observer?.disconnect()
    if (disposed || loading.value || error.value || !hasMore.value || !sentinel.value) return
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void more()
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel.value)
  }

  async function more() {
    if (disposed || loading.value || !hasMore.value || !controller) return
    const version = generation
    const signal = controller.signal
    loading.value = true
    error.value = ''
    observer?.disconnect()
    try {
      const page = await fetchPage(nextCursor, signal)
      if (disposed || version !== generation || signal.aborted) return
      if (page.hasMore && (!page.nextCursor || visited.has(page.nextCursor)))
        throw new Error('The server returned an invalid cursor.')
      const known = new Set(items.value.map(itemKey))
      items.value = [
        ...items.value,
        ...page.items.filter((item) => {
          const key = itemKey(item)
          if (known.has(key)) return false
          known.add(key)
          return true
        }),
      ]
      nextCursor = page.nextCursor
      hasMore.value = page.hasMore
      if (page.nextCursor) visited.add(page.nextCursor)
    } catch (cause) {
      if (!disposed && version === generation && !signal.aborted)
        error.value = cause instanceof Error ? cause.message : 'Unable to load data.'
    } finally {
      if (!disposed && version === generation) {
        loading.value = false
        await nextTick()
        observe()
      }
    }
  }

  async function reset() {
    if (disposed) return
    cancel()
    controller = new AbortController()
    nextCursor = null
    visited.clear()
    items.value = []
    error.value = ''
    hasMore.value = true
    await more()
  }

  function cancel() {
    generation += 1
    controller?.abort()
    observer?.disconnect()
    loading.value = false
    hasMore.value = false
  }

  watch(sentinel, observe, { flush: 'post' })
  onScopeDispose(() => {
    disposed = true
    cancel()
  })
  return { items, loading, error, sentinel, hasMore, reset, more, cancel }
}
