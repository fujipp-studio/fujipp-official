import type { Session } from '@supabase/supabase-js'
import { apiFetch, authenticatedHeaders, backendUrl, readJson } from '@/shared/api/http'

export interface TicketHistoryItem {
  channelId: string
  name: string
  categoryKey: string
  ownerId: string
  status: 'OPEN' | 'CLOSING' | 'CLOSED'
  openedAt: number
  archived?: boolean
}
export interface TicketMessage {
  id: string
  authorId: string
  authorName: string
  bot: boolean
  createdAt: string
  editedAt: string | null
  content: string
  blocks: string[]
  attachments: { name: string; url: string }[]
  replyToId: string | null
}
export interface TicketMessagePage {
  items: TicketMessage[]
  nextBefore: string | null
  hasMore: boolean
}
export function safeTicketAttachmentUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      ['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname) &&
      url.pathname.startsWith('/attachments/') &&
      !url.username &&
      !url.password
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}
export async function fetchTickets(
  botId: string,
  admin: boolean,
  session: Session,
  signal?: AbortSignal,
) {
  const url = `${backendUrl}/api/v1/${admin ? 'admin/' : ''}bots/${encodeURIComponent(botId)}/tickets`
  return readJson<TicketHistoryItem[]>(
    await apiFetch(url, { headers: authenticatedHeaders(session), signal }),
    'Unable to load tickets.',
  )
}
export async function fetchTicketMessages(
  botId: string,
  channelId: string,
  admin: boolean,
  session: Session,
  before?: string | null,
  signal?: AbortSignal,
) {
  const url = new URL(
    `${backendUrl}/api/v1/${admin ? 'admin/' : ''}bots/${encodeURIComponent(botId)}/tickets/${encodeURIComponent(channelId)}/messages`,
  )
  if (before) url.searchParams.set('before', before)
  return readJson<TicketMessagePage>(
    await apiFetch(url, { headers: authenticatedHeaders(session), signal }),
    'Unable to load ticket messages.',
  )
}
