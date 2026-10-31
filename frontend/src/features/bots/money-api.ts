import type { Session } from '@supabase/supabase-js'
import { apiFetch, authenticatedHeaders, backendUrl, readJson } from '@/shared/api/http'

// Satang strings preserve integer precision even for aggregate balances.
export interface MoneyOverview {
  customerCount: number
  balanceSatang: string
  trueMoneyTopupSatang: string
  slipOkTopupSatang: string
  reviewCount: number
  currency: 'THB'
}
export interface MoneyCustomer {
  memberDiscordId: string
  balanceSatang: string
  totalTopupSatang: string
  lastTopupAt: string | null
}
export interface MoneyTopup {
  id: string
  memberDiscordId: string
  provider: 'TRUEMONEY' | 'SLIPOK'
  status:
    | 'CREDITED'
    | 'RECEIVED_PENDING_CREDIT'
    | 'REVIEW_REQUIRED'
    | 'PROCESSING'
    | 'REJECTED'
    | 'LEGACY_RECORD'
  grossSatang: string | null
  feeSatang: string | null
  creditedSatang: string | null
  reference: string | null
  failureCode: string | null
  legacy: boolean
  createdAt: string
}
export interface MoneyPage<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}
export async function fetchMoney<T>(
  botId: string,
  admin: boolean,
  resource: 'overview' | 'customers' | 'topups',
  session: Session,
  params: Record<string, string>,
  signal: AbortSignal,
): Promise<T> {
  const url = new URL(
    `${backendUrl}/api/v1/${admin ? 'admin/' : ''}bots/${encodeURIComponent(botId)}/money/${resource}`,
  )
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
  })
  return readJson<T>(
    await apiFetch(url, { headers: authenticatedHeaders(session), signal }),
    'Unable to load Wallet data.',
  )
}
export function formatWalletMoney(satang: string | null, locale: string): string {
  if (satang === null || !/^-?\d+$/.test(satang)) return '—'
  const amount = BigInt(satang)
  const absolute = amount < 0n ? -amount : amount
  const units = (absolute / 100n).toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB')
  return `${amount < 0n ? '-' : ''}฿${units}.${String(absolute % 100n).padStart(2, '0')}`
}
