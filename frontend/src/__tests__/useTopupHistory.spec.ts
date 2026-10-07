import { effectScope, ref, type EffectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { useTopupHistory } from '../features/topup/composables/useTopupHistory'
import { listWalletTopups, type WalletTopupSummary } from '../features/topup/api'
import type { CursorPage } from '../shared/api/http'

vi.mock('../features/topup/api', () => ({ listWalletTopups: vi.fn<typeof listWalletTopups>() }))
const items = (prefix: string, count = 10): WalletTopupSummary[] =>
  Array.from({ length: count }, (_, i) => ({
    invoiceId: `${prefix}-${i}`,
    invoiceNumber: `${prefix}-${i}`,
    amountSatang: 10000,
    currency: 'THB',
    status: 'SUCCESS',
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  }))
let scope: EffectScope
function setup() {
  scope = effectScope()
  return scope.run(() => useTopupHistory(ref({ access_token: 'test' } as Session)))!
}
beforeEach(() => vi.resetAllMocks())
afterEach(() => scope?.stop())

describe('useTopupHistory', () => {
  it('shows one page at a time, caches visited pages, and disables Next on the last page', async () => {
    vi.mocked(listWalletTopups)
      .mockResolvedValueOnce({ items: items('first'), nextCursor: 'second', hasMore: true })
      .mockResolvedValueOnce({ items: items('second', 3), nextCursor: null, hasMore: false })
    const history = setup()
    await history.reload()
    expect(listWalletTopups).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'test' }),
      null,
      10,
      {},
    )
    expect(history.history.value).toHaveLength(10)
    expect(history.pageNumbers.value).toEqual([1, 2])
    await history.goToPage(2)
    expect(history.history.value.map((item) => item.invoiceId)).toEqual([
      'second-0',
      'second-1',
      'second-2',
    ])
    expect(history.currentPage.value).toBe(2)
    expect(history.hasNext.value).toBe(false)
    await history.goToPage(1)
    await history.goToPage(2)
    expect(listWalletTopups).toHaveBeenCalledTimes(2)
  })

  it('resets the page and cursor when filters change and keeps the same time boundary for subsequent pages', async () => {
    vi.mocked(listWalletTopups).mockResolvedValue({
      items: items('match'),
      nextCursor: 'next',
      hasMore: true,
    })
    const history = setup()
    await history.reload()
    await history.goToPage(2)
    history.status.value = 'SUCCESS'
    history.period.value = '30'
    await flushPromises()
    expect(history.currentPage.value).toBe(1)
    expect(history.filtered.value).toBe(true)
    const filters = vi.mocked(listWalletTopups).mock.calls.at(-1)?.[3]
    expect(filters?.status).toBe('SUCCESS')
    expect(filters?.createdFrom).toBeTruthy()
    expect(Date.now() - Date.parse(filters!.createdFrom!)).toBeGreaterThan(29 * 86400000)
    expect(listWalletTopups).toHaveBeenLastCalledWith(expect.anything(), null, 10, filters)
    await history.goToPage(2)
    expect(listWalletTopups).toHaveBeenLastCalledWith(expect.anything(), 'next', 10, filters)
    history.clearFilters()
    await flushPromises()
    expect(listWalletTopups).toHaveBeenLastCalledWith(expect.anything(), null, 10, {})
    expect(history.currentPage.value).toBe(1)
  })

  it('ignores an old response when a different filter has already finished loading', async () => {
    let resolveOld!: (value: CursorPage<WalletTopupSummary>) => void
    vi.mocked(listWalletTopups)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve
        }),
      )
      .mockResolvedValueOnce({ items: items('filtered', 2), nextCursor: null, hasMore: false })
    const history = setup()
    const oldRequest = history.reload()
    history.status.value = 'SUCCESS'
    await flushPromises()
    resolveOld({ items: items('old'), nextCursor: 'stale', hasMore: true })
    await oldRequest
    expect(history.history.value.map((item) => item.invoiceId)).toEqual([
      'filtered-0',
      'filtered-1',
    ])
    expect(history.loading.value).toBe(false)
    expect(history.hasNext.value).toBe(false)
  })

  it('retains the current page if Next fails and retries the same cursor', async () => {
    vi.mocked(listWalletTopups)
      .mockResolvedValueOnce({ items: items('first'), nextCursor: 'next', hasMore: true })
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ items: items('second', 2), nextCursor: null, hasMore: false })
    const history = setup()
    await history.reload()
    await history.goToPage(2)
    expect(history.currentPage.value).toBe(1)
    expect(history.history.value[0]?.invoiceId).toBe('first-0')
    expect(history.error.value).toBe(true)
    await history.retry()
    expect(history.currentPage.value).toBe(2)
    expect(history.error.value).toBe(false)
    expect(listWalletTopups).toHaveBeenLastCalledWith(expect.anything(), 'next', 10, {})
  })
})
