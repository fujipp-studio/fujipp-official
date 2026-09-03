import type { Session } from '@supabase/supabase-js'

import type { DonationCampaign } from '@/features/donation/api'
import { adminRequest } from '@/shared/api/http'

export function updateDonationSettings(
  input: { title: string; description: string; goalSatang: number },
  session: Session,
) {
  return adminRequest<DonationCampaign>(
    '/api/v1/admin/donations/settings',
    session,
    { method: 'PATCH', body: JSON.stringify(input) },
    'Unable to update donation settings.',
  )
}
