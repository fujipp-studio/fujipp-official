import { queryOptions, type QueryClient } from '@tanstack/vue-query'
import { fetchWork, fetchWorkOverview, fetchWorksPage, type WorkLocale } from './api'
import { fetchGithubContributions } from './github'

export const workKeys = {
  all: ['public', 'work'] as const,
  catalog: (locale: WorkLocale) => ['public', 'work', 'catalog', locale] as const,
  detail: (slug: string, locale: WorkLocale) => ['public', 'work', 'detail', slug, locale] as const,
}

export function workCatalogQuery(locale: WorkLocale) {
  return queryOptions({
    queryKey: workKeys.catalog(locale),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const [overview, firstPage] = await Promise.all([
        fetchWorkOverview(locale, signal),
        fetchWorksPage(locale, { limit: 100, signal }),
      ])
      const works = [...firstPage.items]
      const known = new Set(works.map((work) => work.slug))
      const visited = new Set<string>()
      let page = firstPage
      while (page.hasMore) {
        const cursor = page.nextCursor
        if (!cursor || visited.has(cursor))
          throw new Error('The server returned an invalid cursor.')
        visited.add(cursor)
        page = await fetchWorksPage(locale, { cursor, limit: 100, signal })
        for (const work of page.items) {
          if (!known.has(work.slug)) {
            known.add(work.slug)
            works.push(work)
          }
        }
      }
      return { overview, works }
    },
  })
}

export function workDetailQuery(slug: string, locale: WorkLocale) {
  return queryOptions({
    queryKey: workKeys.detail(slug, locale),
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => fetchWork(slug, locale, signal),
  })
}

export function githubActivityQuery(year = 'last') {
  return queryOptions({
    queryKey: ['public', 'github-activity', year] as const,
    staleTime: 10 * 60_000,
    queryFn: ({ signal }) => fetchGithubContributions(year, signal),
  })
}

export async function invalidateWorkQueries(client: QueryClient) {
  // Cancel first: an older read must never replace a newly saved project.
  await client.cancelQueries({ queryKey: workKeys.all })
  await client.invalidateQueries({ queryKey: workKeys.all })
}
