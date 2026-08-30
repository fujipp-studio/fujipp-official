import type { Session } from '@supabase/supabase-js'
import {
  adminRequest,
  backendUrl,
  fetchAllCursorPages,
  authenticatedHeaders,
} from '@/shared/api/http'

export interface AdminRuntimePlan {
  id: string
  code: string
  name: string
  durationDays: number
  priceSatang: number
  currency: string
  active: boolean
  sortOrder: number
}

export interface AdminRuntimeSubscription {
  id: string
  slotNumber: number
  ownerUserId: string
  ownerDisplayName: string
  planId: string
  planName: string
  botId: string | null
  botName: string | null
  status: 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED'
  autoRenew: boolean
  periodStart: string
  periodEnd: string
  graceUntil: string | null
  planPriceSatang: number
  renewalPriceSatang: number | null
  effectiveRenewalPriceSatang: number
}

export const fetchAdminRuntimePlans = (session: Session) =>
  adminRequest<AdminRuntimePlan[]>(
    '/api/v1/admin/runtime/plans',
    session,
    { method: 'GET' },
    'Unable to load runtime plans.',
  )

export const updateAdminRuntimePlan = (
  id: string,
  input: {
    name: string
    durationDays: number
    priceSatang: number
    active: boolean
    sortOrder: number
  },
  session: Session,
) =>
  adminRequest<AdminRuntimePlan>(
    `/api/v1/admin/runtime/plans/${id}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update runtime plan.',
  )

export const fetchAdminRuntimeSubscriptions = (session: Session, ownerUserId?: string) => {
  const url = new URL(`${backendUrl}/api/v2/admin/runtime/subscriptions`)
  if (ownerUserId) url.searchParams.set('ownerUserId', ownerUserId)
  return fetchAllCursorPages<AdminRuntimeSubscription>(
    url,
    authenticatedHeaders(session, false),
    'Unable to load runtime subscriptions.',
  )
}

export const grantAdminRuntime = (
  input: {
    ownerUserId: string
    planId: string
    botId?: string
    periodEnd?: string
    autoRenew: boolean
    renewalPriceSatang?: number | null
  },
  session: Session,
) =>
  adminRequest<AdminRuntimeSubscription>(
    '/api/v1/admin/runtime/subscriptions',
    session,
    { method: 'POST', body: JSON.stringify(input) },
    'Unable to grant runtime.',
  )

export const updateAdminRuntime = (
  id: string,
  input: {
    status: string
    planId: string
    botId?: string | null
    periodEnd: string
    autoRenew: boolean
    renewalPriceSatang: number | null
  },
  session: Session,
) =>
  adminRequest<AdminRuntimeSubscription>(
    `/api/v1/admin/runtime/subscriptions/${id}`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update runtime.',
  )
