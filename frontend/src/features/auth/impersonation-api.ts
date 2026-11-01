import type { Session } from '@supabase/supabase-js'
import { adminRequest } from '@/shared/api/http'
import type { ImpersonationSession } from './impersonation'

export const impersonationPath = '/api/v1/admin/impersonations'
export function startImpersonation(userId: string, session: Session) {
  return adminRequest<ImpersonationSession>(
    impersonationPath,
    session,
    {
      method: 'POST',
      body: JSON.stringify({ userId }),
    },
    'Unable to start impersonation.',
  )
}

export function stopImpersonation(session: Session) {
  return adminRequest<void>(
    impersonationPath,
    session,
    { method: 'DELETE' },
    'Unable to end impersonation. Please try again.',
  )
}
