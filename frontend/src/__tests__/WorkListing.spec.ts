import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useWorkListing } from '@/features/work/composables/useWorkListing'
import { workCatalogQuery, invalidateWorkQueries } from '@/features/work/queries'
import { testQueryClient } from './setupQuery'
import { fetchWorkOverview, fetchWorksPage, type WorkSummary } from '@/features/work/api'

vi.mock('@/features/work/api', () => ({
  fetchWorkOverview: vi.fn<typeof import('@/features/work/api').fetchWorkOverview>(),
  fetchWorksPage: vi.fn<typeof import('@/features/work/api').fetchWorksPage>(),
}))

const work = (slug: string, code = 'web') =>
  ({ slug, category: { code, name: code } }) as WorkSummary

const scopes: ReturnType<typeof effectScope>[] = []

function listing() {
  const scope = effectScope()
  const locale = ref<'en' | 'th'>('en')
  const category = ref('all')
  const data = scope.run(() => useWorkListing(locale, category, ref(2), testQueryClient))!
  scopes.push(scope)
  return { data, locale, category }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchWorkOverview).mockResolvedValue({
    total: 4,
    categories: [{ code: 'web', name: 'Web', total: 3 }],
    featured: [work('featured')],
  })
  vi.mocked(fetchWorksPage).mockResolvedValue({
    items: [work('one'), work('two')],
    nextCursor: null,
    hasMore: false,
  })
})

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.restoreAllMocks()
})

it('loads all pages once and keeps the results in the session store', async () => {
  vi.mocked(fetchWorksPage)
    .mockResolvedValueOnce({ items: [work('one'), work('two')], nextCursor: 'next', hasMore: true })
    .mockResolvedValueOnce({
      items: [work('three'), work('four')],
      nextCursor: null,
      hasMore: false,
    })

  const { data } = listing()
  expect(await data.load()).toBe(true)
  expect(data.overview.value.featured[0]?.slug).toBe('featured')
  expect(data.works.value.map((item) => item.slug)).toEqual(['one', 'two', 'three', 'four'])
  expect(fetchWorksPage).toHaveBeenCalledTimes(2)
  expect(fetchWorksPage).toHaveBeenLastCalledWith(
    'en',
    expect.objectContaining({ cursor: 'next', limit: 100 }),
  )

  await data.ensureVisible(4)
  expect(await data.load()).toBe(true)
  expect(fetchWorksPage).toHaveBeenCalledTimes(2)
  expect(fetchWorkOverview).toHaveBeenCalledTimes(1)
})

it('filters cached projects and fetches each locale only once', async () => {
  vi.mocked(fetchWorksPage)
    .mockResolvedValueOnce({
      items: [work('web'), work('mobile', 'mobile')],
      nextCursor: null,
      hasMore: false,
    })
    .mockResolvedValueOnce({ items: [work('thai')], nextCursor: null, hasMore: false })

  const { data, category, locale } = listing()
  await data.load()
  category.value = 'web'
  expect(data.works.value.map((item) => item.slug)).toEqual(['web'])

  locale.value = 'th'
  await data.load()
  expect(data.works.value.map((item) => item.slug)).toEqual(['thai'])

  locale.value = 'en'
  await data.load()
  expect(data.works.value.map((item) => item.slug)).toEqual(['web'])
  expect(fetchWorksPage).toHaveBeenCalledTimes(2)
})

it('reports a failed request and succeeds on retry', async () => {
  vi.mocked(fetchWorksPage)
    .mockRejectedValueOnce(new Error('Please retry'))
    .mockResolvedValueOnce({ items: [work('one')], nextCursor: null, hasMore: false })

  const { data } = listing()
  expect(await data.load()).toBe(false)
  expect(data.error.value).toBe('Please retry')
  expect(await data.load()).toBe(true)
  expect(data.error.value).toBe('')
  expect(data.works.value.map((item) => item.slug)).toEqual(['one'])
})

it('joins an in-flight preload when the Work page opens', async () => {
  let resolve!: (page: Awaited<ReturnType<typeof fetchWorksPage>>) => void
  vi.mocked(fetchWorksPage).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    }),
  )
  const warmup = testQueryClient.query(workCatalogQuery('en'))
  const { data } = listing()
  const navigation = data.load()
  expect(fetchWorksPage).toHaveBeenCalledTimes(1)
  resolve({ items: [work('preloaded')], nextCursor: null, hasMore: false })
  await Promise.all([warmup, navigation])
  expect(data.works.value[0]?.slug).toBe('preloaded')
})

it('keeps cached projects visible if an expired cache cannot refresh', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const { data } = listing()
  await data.load()
  now += 5 * 60_000 + 1
  vi.mocked(fetchWorksPage).mockRejectedValueOnce(new Error('Offline'))
  expect(await data.load()).toBe(false)
  expect(data.works.value.map((item) => item.slug)).toEqual(['one', 'two'])
  expect(data.error.value).toBe('')
  expect(fetchWorksPage).toHaveBeenCalledTimes(2)
})

it('does not let an old preload overwrite data after an editor invalidates the cache', async () => {
  let resolve!: (page: Awaited<ReturnType<typeof fetchWorksPage>>) => void
  vi.mocked(fetchWorksPage).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    }),
  )
  const old = testQueryClient.query(workCatalogQuery('en')).catch(() => undefined)
  await invalidateWorkQueries(testQueryClient)
  vi.mocked(fetchWorksPage).mockResolvedValueOnce({
    items: [work('updated')],
    nextCursor: null,
    hasMore: false,
  })
  await testQueryClient.query(workCatalogQuery('en'))
  resolve({ items: [work('outdated')], nextCursor: null, hasMore: false })
  await old
  expect(testQueryClient.getQueryData(workCatalogQuery('en').queryKey)?.works[0]?.slug).toBe(
    'updated',
  )
})
