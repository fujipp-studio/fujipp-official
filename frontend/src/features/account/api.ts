import type { Session } from '@supabase/supabase-js'

import { apiFetch, authenticatedHeaders, backendUrl, readJson } from '@/shared/api/http'

export interface AccountProfile {
  id: string
  username: string | null
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  profileCompletedAt: string | null
}

export interface UpdateAccountProfileInput {
  displayName: string
  firstName: string | null
  lastName: string | null
}

export async function fetchAccountProfile(session: Session): Promise<AccountProfile> {
  const response = await apiFetch(`${backendUrl}/api/v1/auth/me/profile`, {
    headers: authenticatedHeaders(session),
  })
  return readJson<AccountProfile>(response, 'Unable to load your profile.')
}

export async function updateAccountProfile(
  input: UpdateAccountProfileInput,
  session: Session,
): Promise<AccountProfile> {
  const response = await apiFetch(`${backendUrl}/api/v1/auth/me/profile`, {
    method: 'PUT',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify(input),
  })
  return readJson<AccountProfile>(response, 'Unable to update your profile.')
}

export async function setAccountUsername(
  username: string,
  session: Session,
): Promise<AccountProfile> {
  const response = await apiFetch(`${backendUrl}/api/v1/auth/me/username`, {
    method: 'PUT',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify({ username }),
  })
  return readJson<AccountProfile>(response, 'Unable to set your username.')
}

export async function uploadAccountAvatar(
  file: File,
  session: Session,
): Promise<AccountProfile> {
  const form = new FormData()
  form.append('file', file)
  const response = await apiFetch(`${backendUrl}/api/v1/auth/me/avatar`, {
    method: 'POST',
    headers: authenticatedHeaders(session),
    body: form,
  })
  return readJson<AccountProfile>(response, 'Unable to update your profile image.')
}

export async function deleteAccountAvatar(session: Session): Promise<AccountProfile> {
  const response = await apiFetch(`${backendUrl}/api/v1/auth/me/avatar`, {
    method: 'DELETE',
    headers: authenticatedHeaders(session),
  })
  return readJson<AccountProfile>(response, 'Unable to remove your profile image.')
}
