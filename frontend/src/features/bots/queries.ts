import { queryOptions, type QueryClient } from '@tanstack/vue-query'
import type { Session } from '@supabase/supabase-js'
import { fetchBot, fetchBots, fetchFeatureLicenses, type UserBot } from './api'
import { fetchRuntimeSubscriptions } from './runtime-api'

export const accountKeys = {
  all: (session: Session) => ['account', session.user.id] as const,
  bots: (session: Session) => ['account', session.user.id, 'bots'] as const,
  list: (session: Session) => ['account', session.user.id, 'bots', 'list'] as const,
  bot: (session: Session, id: string) =>
    ['account', session.user.id, 'bots', 'detail', id] as const,
}
export function botListQuery(session: Session) {
  return queryOptions({
    queryKey: accountKeys.list(session),
    staleTime: 5_000,
    queryFn: ({ signal }) => fetchBots(session, signal),
  })
}
export function botDetailQuery(session: Session, id: string) {
  return queryOptions({
    queryKey: accountKeys.bot(session, id),
    staleTime: 5_000,
    queryFn: ({ signal }) => fetchBot(id, session, signal),
  })
}
export function botLicensesQuery(session: Session) {
  return queryOptions({
    queryKey: [...accountKeys.all(session), 'licenses'] as const,
    staleTime: 30_000,
    queryFn: ({ signal }) => fetchFeatureLicenses(session, signal),
  })
}
export function botRuntimesQuery(session: Session) {
  return queryOptions({
    queryKey: [...accountKeys.all(session), 'runtimes'] as const,
    staleTime: 5_000,
    queryFn: ({ signal }) => fetchRuntimeSubscriptions(session, signal),
  })
}
export function cacheBot(client: QueryClient, session: Session, bot: UserBot) {
  client.setQueryData(accountKeys.bot(session, bot.id), bot)
  client.setQueryData<UserBot[]>(accountKeys.list(session), (current) =>
    current?.map((item) => (item.id === bot.id ? bot : item)),
  )
}
export async function invalidateBotAccount(client: QueryClient, session: Session) {
  await client.cancelQueries({ queryKey: accountKeys.all(session) })
  await client.invalidateQueries({ queryKey: accountKeys.all(session), refetchType: 'none' })
}
