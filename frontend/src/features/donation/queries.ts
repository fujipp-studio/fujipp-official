import { queryOptions } from '@tanstack/vue-query'
import { fetchDonationCampaign } from './api'

export const donationCampaignKey = ['public', 'donation-campaign'] as const
export function donationCampaignQuery() {
  return queryOptions({
    queryKey: donationCampaignKey,
    staleTime: 30_000,
    queryFn: ({ signal }) => fetchDonationCampaign(signal),
  })
}
