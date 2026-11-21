import type { Session } from '@supabase/supabase-js'
import { apiFetch, authenticatedHeaders, backendUrl, readJson } from '@/shared/api/http'

export interface BackupQuota {
  remaining: number
  limit: number
  resetsAt: string
}
export async function spendingBackupRequest(
  botId: string,
  licenseId: string,
  admin: boolean,
  session: Session,
  download = false,
  signal?: AbortSignal,
) {
  const path = `/api/v1/${admin ? 'admin/' : ''}bots/${encodeURIComponent(botId)}/licenses/${encodeURIComponent(licenseId)}/member-spending/backup`
  return apiFetch(`${backendUrl}${path}`, {
    method: download ? 'POST' : 'GET',
    headers: {
      ...authenticatedHeaders(session),
      Accept: download ? 'application/zip' : 'application/json',
    },
    signal,
  })
}
export async function readBackupQuota(response: Response) {
  return readJson<BackupQuota>(response, 'Unable to load backup quota.')
}
export async function readBackupDownload(response: Response) {
  if (!response.ok) await readJson(response, 'Unable to download backup.')
  const filename = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1]
  if (!filename || !/^fujipp_member-spending_[a-zA-Z0-9_-]+\.zip$/.test(filename))
    throw new Error('The backup filename is invalid. Please try again.')
  return { filename, blob: await response.blob() }
}
