import { useQueryClient } from '@tanstack/vue-query'
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export function useWorkPreload() {
  const client = useQueryClient()
  const { locale } = useI18n()
  let mounted = false
  let disposed = false
  let cancelScheduled = () => {}

  async function preload() {
    try {
      // Data modules only: don't render the calendar or download all cover images
      // while the visitor is reading another page.
      const { workCatalogQuery, githubActivityQuery } = await import('../queries')
      if (disposed || document.hidden) return
      await Promise.allSettled([
        client.query(workCatalogQuery(locale.value === 'th' ? 'th' : 'en')),
        client.query(githubActivityQuery()),
      ])
    } catch {
      // Optional preloading never blocks a page; normal navigation can retry.
    }
  }

  function schedule() {
    cancelScheduled()
    cancelScheduled = () => {}
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (
      !mounted ||
      disposed ||
      document.readyState !== 'complete' ||
      document.hidden ||
      connection?.saveData
    )
      return
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(() => void preload(), { timeout: 2500 })
      cancelScheduled = () => window.cancelIdleCallback(handle)
    } else {
      const handle = window.setTimeout(() => void preload(), 500)
      cancelScheduled = () => window.clearTimeout(handle)
    }
  }

  watch(locale, schedule)
  onMounted(() => {
    mounted = true
    window.addEventListener('load', schedule)
    document.addEventListener('visibilitychange', schedule)
    schedule()
  })
  onBeforeUnmount(() => {
    disposed = true
    cancelScheduled()
    window.removeEventListener('load', schedule)
    document.removeEventListener('visibilitychange', schedule)
  })
}
