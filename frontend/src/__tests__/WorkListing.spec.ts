import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useWorkListing } from '@/features/work/composables/useWorkListing'
import { fetchWorkOverview, fetchWorksPage, type WorkSummary } from '@/features/work/api'
import { deferred } from './fixtures/domain'

vi.mock('@/features/work/api', () => ({
  fetchWorkOverview: vi.fn<typeof import('@/features/work/api').fetchWorkOverview>(),
  fetchWorksPage: vi.fn<typeof import('@/features/work/api').fetchWorksPage>(),
}))
const work = (slug: string) => ({ slug, category: { code: 'web', name: 'Web' } }) as WorkSummary
const scope = () => {
  const scope = effectScope(),
    locale = ref<'en' | 'th'>('en'),
    category = ref('all')
  const data = scope.run(() => useWorkListing(locale, category, ref(2)))!
  scopes.push(scope)
  return { data, locale, category }
}
const scopes: ReturnType<typeof effectScope>[] = []
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchWorkOverview).mockResolvedValue({
    total: 8,
    categories: [{ code: 'web', name: 'Web', total: 8 }],
    featured: [work('featured')],
  })
  vi.mocked(fetchWorksPage).mockResolvedValue({
    items: [work('one'), work('two')],
    nextCursor: 'next',
    hasMore: true,
  })
})
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()))

it('loads the visible page, retains totals/featured work, and requests more only on demand', async () => {
  const { data } = scope()
  await data.load()
  expect(fetchWorksPage).toHaveBeenCalledTimes(1)
  expect(fetchWorkOverview).toHaveBeenCalledTimes(1)
  expect(data.total.value).toBe(8)
  expect(data.overview.value.featured[0]?.slug).toBe('featured')
  vi.mocked(fetchWorksPage).mockResolvedValueOnce({
    items: [work('three'), work('four')],
    nextCursor: 'next-2',
    hasMore: true,
  })
  await data.ensureVisible(4)
  expect(data.works.value.map((item) => item.slug)).toEqual(['one', 'two', 'three', 'four'])
  expect(fetchWorksPage).toHaveBeenLastCalledWith(
    'en',
    expect.objectContaining({ cursor: 'next', limit: 2 }),
  )
  await data.ensureVisible(2)
  expect(fetchWorksPage).toHaveBeenCalledTimes(2)
})

it('discards a previous locale request and keeps already visible results when Load more fails', async () => {
  const { data, locale } = scope()
  const old = deferred<Awaited<ReturnType<typeof fetchWorksPage>>>()
  vi.mocked(fetchWorksPage).mockReturnValueOnce(old.promise)
  const pending = data.load()
  locale.value = 'th'
  await data.load()
  old.resolve({ items: [work('stale')], nextCursor: null, hasMore: false })
  expect(await pending).toBe(false)
  expect(data.works.value.map((item) => item.slug)).toEqual(['one', 'two'])
  vi.mocked(fetchWorksPage).mockRejectedValueOnce(new Error('Please retry'))
  await data.ensureVisible(4)
  expect(data.works.value).toHaveLength(2)
  expect(data.error.value).toBe('')
  expect(data.moreError.value).toBe('Please retry')
})

it('does not reveal stale pages after a filter change and stops cyclic cursors', async () => {
  const { data, category } = scope()
  await data.load()
  const old = deferred<Awaited<ReturnType<typeof fetchWorksPage>>>()
  vi.mocked(fetchWorksPage).mockReturnValueOnce(old.promise)
  const pending = data.ensureVisible(4)
  category.value = 'web'
  await data.load()
  old.resolve({ items: [work('stale')], nextCursor: null, hasMore: false })
  expect(await pending).toBe(false)
  expect(data.works.value.map((item) => item.slug)).toEqual(['one', 'two'])
  vi.mocked(fetchWorksPage)
    .mockResolvedValueOnce({ items: [work('three')], nextCursor: 'another', hasMore: true })
    .mockResolvedValueOnce({ items: [work('four')], nextCursor: 'next', hasMore: true })
  await data.ensureVisible(8)
  expect(data.moreError.value).toContain('invalid cursor')
  expect(data.works.value.map((item) => item.slug)).toEqual(['one', 'two', 'three'])
})
