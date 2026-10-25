import { queryOptions } from '@tanstack/vue-query'
import { fetchStoreFeatures } from './api'
import { fetchRuntimeAvailability } from '@/features/bots/runtime-api'

export const storeCatalogKey = ['public', 'store', 'catalog'] as const
export const runtimeAvailabilityKey = ['public', 'runtime-availability'] as const

export function storeCatalogQuery() {
  return queryOptions({
    queryKey: storeCatalogKey,
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => fetchStoreFeatures(signal),
  })
}

export function runtimeAvailabilityQuery() {
  return queryOptions({
    queryKey: runtimeAvailabilityKey,
    staleTime: 0,
    queryFn: ({ signal }) => fetchRuntimeAvailability(signal),
  })
}
