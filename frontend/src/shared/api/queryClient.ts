import { QueryClient } from '@tanstack/vue-query'

/** One client per app. Private query keys always begin with ['account', userId]. */
export function createApiQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 15 * 60_000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      // Purchases and other writes retain their existing explicit retry/idempotency flow.
      mutations: { retry: false },
    },
  })
}

export function clearAccountQueries(client: QueryClient) {
  client.removeQueries({ queryKey: ['account'] })
}
