import { effectScope } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import type { CursorPage } from '@/shared/api/http'
import { useCursorCollection } from '@/shared/api/useCursorCollection'
import { deferred } from './fixtures/domain'

afterEach(() => vi.unstubAllGlobals())
it('loads one page and cancels stale pages when the search changes', async () => {
  const old = deferred<{ items: string[]; hasMore: boolean; nextCursor: string | null }>()
  const fetchPage = vi
    .fn<(cursor: string | null, signal: AbortSignal) => Promise<CursorPage<string>>>()
    .mockResolvedValueOnce({ items: ['first'], hasMore: true, nextCursor: 'next' })
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ items: ['new search'], hasMore: false, nextCursor: null })
  const scope = effectScope()
  const data = scope.run(() => useCursorCollection<string>(fetchPage, (item) => item))!
  await data.reset()
  expect(fetchPage).toHaveBeenCalledTimes(1)
  const pending = data.more()
  await data.more()
  expect(fetchPage).toHaveBeenCalledTimes(2)
  await data.reset()
  expect(fetchPage.mock.calls[1]?.[1].aborted).toBe(true)
  old.resolve({ items: ['stale'], hasMore: false, nextCursor: null })
  await pending
  expect(data.items.value).toEqual(['new search'])
  scope.stop()
})

it('stops invalid cursors instead of looping and preserves loaded rows', async () => {
  const fetchPage = vi
    .fn<(cursor: string | null, signal: AbortSignal) => Promise<CursorPage<string>>>()
    .mockResolvedValue({ items: ['first'], hasMore: true, nextCursor: 'same' })
  const scope = effectScope()
  const data = scope.run(() => useCursorCollection<string>(fetchPage, (item) => item))!
  await data.reset()
  await data.more()
  expect(data.error.value).toContain('invalid cursor')
  expect(data.items.value).toEqual(['first'])
  expect(fetchPage).toHaveBeenCalledTimes(2)
  scope.stop()
})
