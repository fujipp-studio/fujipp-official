import type { Session } from '@supabase/supabase-js'
import { apiFetch, authenticatedHeaders, backendUrl, readJson } from '@/shared/api/http'

export interface FeatureHealth {
  installationId: string
  licenseId: string
  featureCode: string
  featureName: string
  version: string
  status: string
  errorCategory: 'CONFIGURATION' | 'PERMISSION' | 'TRANSIENT' | 'INTERNAL' | null
  errorCode: string | null
  errorMessage: string | null
  hint: string
  lastErrorAt: string | null
  recoveryAttempts: number
  nextRetryAt: string | null
  canRetry: boolean
}
function path(botId: string, admin: boolean) {
  return `${backendUrl}/api/v1/${admin ? 'admin/' : ''}bots/${encodeURIComponent(botId)}`
}
export async function fetchFeatureHealth(
  botId: string,
  admin: boolean,
  session: Session,
  signal: AbortSignal,
) {
  const response = await apiFetch(`${path(botId, admin)}/feature-health`, {
    headers: authenticatedHeaders(session),
    signal,
  })
  return readJson<FeatureHealth[]>(response, 'Unable to load feature status.')
}
export async function retryFeature(
  botId: string,
  installationId: string,
  admin: boolean,
  session: Session,
  signal: AbortSignal,
) {
  const response = await apiFetch(
    `${path(botId, admin)}/installations/${encodeURIComponent(installationId)}/retry`,
    {
      method: 'POST',
      headers: authenticatedHeaders(session),
      signal,
    },
  )
  if (!response.ok) await readJson(response, 'Unable to restart this feature.')
}
