import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { listWalletTopups, type WalletTopupHistoryFilters, type WalletTopupSummary } from '../api'
import type { CursorPage } from '@/shared/api/http'

export const topupStatuses = [
  'PENDING',
  'VERIFYING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
] as const
export const topupHistoryPageSize = 10

export function useTopupHistory(session: Ref<Session | null>) {
  const status = ref('ALL')
  const period = ref('ALL')
  const pages = ref<CursorPage<WalletTopupSummary>[]>([])
  const currentPage = ref(1)
  const loading = ref(false)
  const error = ref(false)
  let generation = 0
  let failedPage = 1
  let filters: WalletTopupHistoryFilters = {}

  const history = computed(() => pages.value[currentPage.value - 1]?.items ?? [])
  const hasPrevious = computed(() => currentPage.value > 1)
  const hasNext = computed(() => Boolean(pages.value[currentPage.value - 1]?.hasMore))
  const pageNumbers = computed(() => {
    const start = Math.max(1, currentPage.value - 1)
    const end = Math.min(pages.value.length + (pages.value.at(-1)?.hasMore ? 1 : 0), start + 2)
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i)
  })
  const filtered = computed(() => status.value !== 'ALL' || period.value !== 'ALL')

  async function fetchPage(pageNumber: number, cursor: string | null, version: number) {
    const activeSession = session.value
    if (!activeSession) return
    loading.value = true
    error.value = false
    failedPage = pageNumber
    try {
      const page = await listWalletTopups(activeSession, cursor, topupHistoryPageSize, filters)
      if (version !== generation) return
      pages.value[pageNumber - 1] = page
      currentPage.value = pageNumber
    } catch {
      if (version === generation) error.value = true
    } finally {
      if (version === generation) loading.value = false
    }
  }

  function reload() {
    generation++
    pages.value = []
    currentPage.value = 1
    return fetchPage(1, null, generation)
  }

  async function goToPage(pageNumber: number) {
    if (loading.value || pageNumber < 1) return
    const cached = pages.value[pageNumber - 1]
    if (cached) {
      currentPage.value = pageNumber
      error.value = false
      return
    }
    const previous = pages.value[pageNumber - 2]
    if (!previous?.hasMore || !previous.nextCursor) return
    await fetchPage(pageNumber, previous.nextCursor, generation)
  }

  function retry() {
    if (loading.value) return
    return fetchPage(
      failedPage,
      failedPage > 1 ? (pages.value[failedPage - 2]?.nextCursor ?? null) : null,
      generation,
    )
  }

  function clearFilters() {
    status.value = 'ALL'
    period.value = 'ALL'
  }

  watch([status, period], () => {
    filters = {}
    if (topupStatuses.includes(status.value as (typeof topupStatuses)[number]))
      filters.status = status.value as (typeof topupStatuses)[number]
    if (['7', '30', '90'].includes(period.value))
      filters.createdFrom = new Date(Date.now() - Number(period.value) * 86_400_000).toISOString()
    void reload()
  })
  onScopeDispose(() => generation++)

  return {
    status,
    period,
    history,
    currentPage,
    loading,
    error,
    hasPrevious,
    hasNext,
    pageNumbers,
    filtered,
    reload,
    goToPage,
    retry,
    clearFilters,
  }
}
