import { apiFetch } from '@/shared/api/http'
import type { Session } from '@supabase/supabase-js'
import {
  backendUrl,
  fetchAllCursorPages,
  authenticatedHeaders,
  adminRequest,
} from '@/shared/api/http'

export interface AdminUserSummary {
  customerId: string
  userId: string | null
  customerCode: string
  email: string | null
  displayName: string | null
  status: string
  role: string
  balanceSatang: number
  createdAt: string
}

export interface AdminWalletHistoryEntry {
  id: string
  direction: 'CREDIT' | 'DEBIT'
  entryType: string
  amountSatang: number
  balanceBeforeSatang: number
  balanceAfterSatang: number
  referenceType: string | null
  referenceId: string | null
  description: string | null
  createdAt: string
}

export interface AdminWalletHistoryResponse {
  customerId: string
  walletId: string
  currentBalanceSatang: number
  entries: AdminWalletHistoryEntry[]
}

export async function fetchAdminUsers(
  session: Session,
  query?: string,
): Promise<AdminUserSummary[]> {
  const url = new URL(`${backendUrl}/api/v2/admin/users`)
  if (query) url.searchParams.set('query', query)
  return fetchAllCursorPages<AdminUserSummary>(
    url,
    authenticatedHeaders(session, false),
    'โหลดรายการผู้ใช้ไม่สำเร็จ',
  )
}

export async function adjustUserWallet(
  customerId: string,
  input: {
    direction: 'CREDIT' | 'DEBIT'
    entryType: string
    amountSatang: number
    description?: string
    idempotencyKey: string
  },
  session: Session,
): Promise<void> {
  const response = await apiFetch(
    `${backendUrl}/api/v1/admin/users/${encodeURIComponent(customerId)}/wallet/adjust`,
    {
      method: 'POST',
      headers: authenticatedHeaders(session, true),
      body: JSON.stringify(input),
    },
  )
  if (!response.ok) {
    let bodyText = ''
    try {
      bodyText = await response.text()
    } catch {}
    throw new Error(
      `ปรับปรุงยอดเงินไม่สำเร็จ (HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''})`,
    )
  }
}

export type AdminAccountRole = 'USER' | 'TESTER' | 'EDITOR' | 'ADMIN'

export type AdminAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DEACTIVATED'

export interface AdminFeatureLicense {
  id: string
  featureProductId: string
  featureCode: string
  featureName: string
  version: string
  status: string
  installationLimit: number
  acquiredAt: string
  expiresAt: string | null
}

export const updateAdminUser = (
  userId: string,
  input: {
    role: AdminAccountRole
    status: AdminAccountStatus
    displayName?: string
    firstName?: string
    lastName?: string
  },
  session: Session,
) =>
  adminRequest<AdminUserSummary>(
    `/api/v1/admin/users/${userId}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update user.',
  )

export const fetchAdminUserFeatures = (userId: string, session: Session) =>
  adminRequest<AdminFeatureLicense[]>(
    `/api/v1/admin/users/${userId}/features`,
    session,
    { method: 'GET' },
    'Unable to load user features.',
  )

export const grantAdminUserFeature = (
  userId: string,
  input: { featureProductId: string; installationLimit: number; expiresAt?: string },
  session: Session,
) =>
  adminRequest<AdminFeatureLicense>(
    `/api/v1/admin/users/${userId}/features`,
    session,
    { method: 'POST', body: JSON.stringify(input) },
    'Unable to grant feature.',
  )

export const updateAdminUserFeature = (
  userId: string,
  licenseId: string,
  input: { status: string; installationLimit: number; expiresAt?: string | null },
  session: Session,
) =>
  adminRequest<AdminFeatureLicense>(
    `/api/v1/admin/users/${userId}/features/${licenseId}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update feature license.',
  )

export async function fetchUserWalletHistory(
  customerId: string,
  session: Session,
): Promise<AdminWalletHistoryResponse> {
  const response = await apiFetch(
    `${backendUrl}/api/v1/admin/users/${encodeURIComponent(customerId)}/wallet/history`,
    {
      headers: authenticatedHeaders(session, false),
    },
  )
  if (!response.ok) {
    let bodyText = ''
    try {
      bodyText = await response.text()
    } catch {}
    throw new Error(
      `โหลดประวัติกระเป๋าไม่สำเร็จ (HTTP ${response.status}${bodyText ? `: ${bodyText}` : ''})`,
    )
  }
  const metadata = (await response.json()) as AdminWalletHistoryResponse
  const url = new URL(
    `${backendUrl}/api/v2/admin/users/${encodeURIComponent(customerId)}/wallet/history`,
  )
  metadata.entries = await fetchAllCursorPages<AdminWalletHistoryEntry>(
    url,
    authenticatedHeaders(session, false),
    'โหลดประวัติกระเป๋าไม่สำเร็จ',
  )
  return metadata
}
