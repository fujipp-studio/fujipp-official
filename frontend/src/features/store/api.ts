import { apiFetch } from '@/shared/api/http'
import type { Session } from '@supabase/supabase-js'
import { backendUrl, readJson, authenticatedHeaders } from '@/shared/api/http'

export interface StoreOffer {
  id: string
  code: string
  name: string
  kind: string
  priceSatang: number
  currency: string
  billingPeriodDays: number | null
  installationLimit: number
}

export interface StoreFeature {
  id: string
  code: string
  name: string
  description: string
  category: string
  iconKey: string
  image: { url: string; altText: string | null } | null
  tutorialUrl: string | null
  featured: boolean
  version: string
  offers: StoreOffer[]
}

export interface StoreOrder {
  id: string
  orderNumber: string
  status: string
  totalSatang: number
  currency: string
  paidAt: string | null
  licenseIds: string[]
}

export async function fetchStoreFeatures(signal?: AbortSignal): Promise<StoreFeature[]> {
  const response = await apiFetch(`${backendUrl}/api/v1/store/features`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  return readJson<StoreFeature[]>(response, 'Unable to load the store.')
}

export async function checkoutStoreOffer(
  offerId: string,
  quantity: number,
  session: Session,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<StoreOrder> {
  const response = await apiFetch(`${backendUrl}/api/v1/store/orders`, {
    method: 'POST',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify({ offerId, quantity, idempotencyKey }),
  })
  return readJson<StoreOrder>(response, 'Unable to complete this purchase.')
}
