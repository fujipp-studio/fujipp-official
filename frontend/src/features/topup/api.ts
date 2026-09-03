import { apiFetch } from '@/shared/api/http'
import type { Session } from '@supabase/supabase-js'
import { backendUrl, authenticatedHeaders, readJson, type CursorPage } from '@/shared/api/http'

export interface WalletTopupInvoice {
  invoiceId: string
  invoiceNumber: string
  amountSatang: number
  currency: string
  status: 'PENDING' | 'VERIFYING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
  promptPayAccountName: string
  qrImageUrl: string
  balanceSatang: number
  expiresAt: string
  completedAt: string | null
  createdAt: string
}

export type WalletTopupSummary = Pick<
  WalletTopupInvoice,
  | 'invoiceId'
  | 'invoiceNumber'
  | 'amountSatang'
  | 'currency'
  | 'status'
  | 'expiresAt'
  | 'completedAt'
  | 'createdAt'
>

export async function createWalletTopup(
  amountSatang: number,
  session: Session,
  idempotencyKey: string = crypto.randomUUID(),
  donationId?: string,
): Promise<WalletTopupInvoice> {
  const response = await apiFetch(`${backendUrl}/api/v1/wallet/topups`, {
    method: 'POST',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify({ amountSatang, idempotencyKey, donationId }),
  })
  return readJson<WalletTopupInvoice>(response, 'Unable to create a top-up request.')
}

export async function fetchWalletTopup(
  invoiceId: string,
  session: Session,
): Promise<WalletTopupInvoice> {
  const response = await apiFetch(
    `${backendUrl}/api/v1/wallet/topups/${encodeURIComponent(invoiceId)}`,
    { headers: authenticatedHeaders(session) },
  )
  return readJson<WalletTopupInvoice>(response, 'Unable to load the top-up request.')
}

export async function listWalletTopups(
  session: Session,
  cursor?: string | null,
  limit = 10,
): Promise<CursorPage<WalletTopupSummary>> {
  const url = new URL(`${backendUrl}/api/v1/wallet/topups`)
  url.searchParams.set('limit', String(limit))
  if (cursor) url.searchParams.set('cursor', cursor)
  const response = await apiFetch(url, { headers: authenticatedHeaders(session) })
  return readJson<CursorPage<WalletTopupSummary>>(response, 'Unable to load top-up history.')
}

export async function verifyWalletTopupSlip(
  invoiceId: string,
  file: File,
  session: Session,
): Promise<WalletTopupInvoice> {
  const body = new FormData()
  body.append('file', file)
  const response = await apiFetch(
    `${backendUrl}/api/v1/wallet/topups/${encodeURIComponent(invoiceId)}/slip`,
    { method: 'POST', headers: authenticatedHeaders(session), body },
  )
  return readJson<WalletTopupInvoice>(response, 'Unable to verify the payment slip.')
}
