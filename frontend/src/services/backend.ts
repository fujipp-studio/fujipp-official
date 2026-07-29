import type { Session } from '@supabase/supabase-js'

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
}

interface ProblemResponse {
  title?: string
  detail?: string
}

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8080'

export async function fetchCurrentUser(session: Session): Promise<CurrentUser> {
  const response = await fetch(`${backendUrl}/api/v1/auth/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ProblemResponse
    throw new Error(problem.detail ?? problem.title ?? 'Unable to load your account.')
  }

  return (await response.json()) as CurrentUser
}
