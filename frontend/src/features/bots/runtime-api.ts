import { apiFetch } from '@/shared/api/http'
import type { Session } from '@supabase/supabase-js'
import { backendUrl, authenticatedHeaders, readJson } from '@/shared/api/http'

export interface RuntimeSubscription {
  id: string
  slotNumber: number
  planId: string
  planName: string
  durationDays: number
  priceSatang: number
  renewalPriceSatang: number | null
  effectiveRenewalPriceSatang: number
  currency: string
  botId: string | null
  botName: string | null
  status: 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED'
  autoRenew: boolean
  currentPeriodEnd: string
  graceUntil: string | null
}

export interface RuntimeAvailability {
  totalSlots: number
  usedSlots: number
  availableSlots: number
  slots: Array<{ slotNumber: number; occupancy: 'AVAILABLE' | 'OCCUPIED' }>
}

export async function purchaseRuntime(planId: string, session: Session) {
  const response = await apiFetch(`${backendUrl}/api/v1/runtime/subscriptions`, {
    method: 'POST',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify({ planId }),
  })
  return readJson<RuntimeSubscription>(response, 'Unable to purchase this Runtime slot.')
}

export async function fetchRuntimeAvailability(signal?: AbortSignal) {
  const response = await apiFetch(`${backendUrl}/api/v1/runtime/availability`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  return readJson<RuntimeAvailability>(response, 'Unable to load Runtime availability.')
}

export async function fetchRuntimeSubscriptions(session: Session) {
  const response = await apiFetch(`${backendUrl}/api/v1/runtime/subscriptions`, {
    headers: authenticatedHeaders(session),
  })
  return readJson<RuntimeSubscription[]>(response, 'Unable to load Runtime slots.')
}

export async function assignRuntime(subscriptionId: string, botId: string, session: Session) {
  const response = await apiFetch(
    `${backendUrl}/api/v1/runtime/subscriptions/${subscriptionId}/bot`,
    {
      method: 'PUT',
      headers: authenticatedHeaders(session, true),
      body: JSON.stringify({ botId }),
    },
  )
  return readJson<RuntimeSubscription>(response, 'Unable to assign this Runtime slot.')
}

export async function updateRuntimeAutoRenew(
  subscriptionId: string,
  autoRenew: boolean,
  session: Session,
) {
  const response = await apiFetch(
    `${backendUrl}/api/v1/runtime/subscriptions/${subscriptionId}/auto-renew`,
    {
      method: 'PUT',
      headers: authenticatedHeaders(session, true),
      body: JSON.stringify({ autoRenew }),
    },
  )
  return readJson<RuntimeSubscription>(response, 'Unable to update automatic renewal.')
}

export async function renewRuntime(subscriptionId: string, session: Session) {
  const response = await apiFetch(
    `${backendUrl}/api/v1/runtime/subscriptions/${subscriptionId}/renew`,
    {
      method: 'POST',
      headers: authenticatedHeaders(session),
    },
  )
  return readJson<RuntimeSubscription>(response, 'Unable to renew this Runtime slot.')
}
