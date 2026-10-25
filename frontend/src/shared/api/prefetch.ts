import type { QueryClient } from '@tanstack/vue-query'
import type { WorkLocale } from '@/features/work/api'

/** Warm likely next pages on navigation intent, without rendering their views. */
export async function prefetchPublicRoute(client: QueryClient, path: string, locale: WorkLocale) {
  try {
    if (path === '/work') {
      const { workCatalogQuery } = await import('@/features/work/queries')
      await client.query(workCatalogQuery(locale))
    } else if (path.startsWith('/store')) {
      const { storeCatalogQuery } = await import('@/features/store/queries')
      await client.query(storeCatalogQuery())
    } else if (['/about', '/support', '/supports'].includes(path)) {
      const { donationCampaignQuery } = await import('@/features/donation/queries')
      await client.query(donationCampaignQuery())
    }
  } catch {
    // The destination page owns its error/retry UI.
  }
}
