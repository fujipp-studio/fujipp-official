import type { Session } from '@supabase/supabase-js'

import { apiFetch, authenticatedHeaders, backendUrl, readJson } from '@/shared/api/http'

export interface DonationLeaderboardEntry {
  rank: number
  displayName: string
  totalSatang: number
  donationCount: number
  lastDonatedAt: string
}

export interface DonationCampaign {
  title: string
  description: string
  goalSatang: number
  raisedSatang: number
  supporterCount: number
  leaderboard: DonationLeaderboardEntry[]
  updatedAt: string
}

export type DonationFundingMethod = 'WALLET' | 'TOPUP'

export interface Donation {
  donationId: string
  donationNumber: string
  donorName: string
  message: string | null
  anonymous: boolean
  amountSatang: number
  currency: string
  fundingMethod: DonationFundingMethod
  status: 'PENDING' | 'SUCCESS' | 'CANCELLED'
  balanceSatang: number
  completedAt: string | null
  createdAt: string
}

export interface CreateDonationInput {
  amountSatang: number
  donorName: string
  message: string
  anonymous: boolean
  fundingMethod: DonationFundingMethod
  idempotencyKey: string
}

export async function fetchDonationCampaign(): Promise<DonationCampaign> {
  const response = await apiFetch(`${backendUrl}/api/v1/donations/campaign`, {
    headers: { Accept: 'application/json' },
  })
  return readJson<DonationCampaign>(response, 'Unable to load the donation campaign.')
}

export async function createDonation(
  input: CreateDonationInput,
  session: Session,
): Promise<Donation> {
  const response = await apiFetch(`${backendUrl}/api/v1/donations`, {
    method: 'POST',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify(input),
  })
  return readJson<Donation>(response, 'Unable to create a donation.')
}

export async function fetchDonation(
  donationId: string,
  session: Session,
): Promise<Donation> {
  const response = await apiFetch(
    `${backendUrl}/api/v1/donations/${encodeURIComponent(donationId)}`,
    { headers: authenticatedHeaders(session) },
  )
  return readJson<Donation>(response, 'Unable to load the donation.')
}
