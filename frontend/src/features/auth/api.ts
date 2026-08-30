import { apiFetch } from '@/shared/api/http'
import type { Session } from '@supabase/supabase-js'
import { backendUrl, readJson } from '@/shared/api/http'

export interface CurrentUser {
  id: string
  email: string | null
  role: 'USER' | 'TESTER' | 'EDITOR' | 'ADMIN'
  status: 'ACTIVE'
  username: string | null
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  profileCompletedAt: string | null
  walletBalanceSatang?: number
  walletBalance?: number
}

export async function fetchCurrentUser(session: Session): Promise<CurrentUser> {
  const response = await apiFetch(`${backendUrl}/api/v1/auth/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  const user = await readJson<CurrentUser>(response, 'Unable to load your account.')
  const rawObj = user as unknown as Record<string, unknown>
  const rawSatang = rawObj.walletBalanceSatang ?? rawObj.balanceSatang ?? rawObj.balance_satang
  if (typeof rawSatang === 'number') {
    user.walletBalanceSatang = rawSatang
    user.walletBalance = rawSatang / 100
  } else if (user.walletBalanceSatang !== undefined) {
    user.walletBalance = user.walletBalanceSatang / 100
  } else {
    user.walletBalanceSatang = 0
    user.walletBalance = 0
  }
  return user
}
