import type { Session } from '@supabase/supabase-js'
import {
  backendUrl,
  fetchAllCursorPages,
  authenticatedHeaders,
  adminRequest,
} from '@/shared/api/http'
import {
  type UserBot,
  type FeatureLicense,
  type FeatureConfiguration,
  type FeatureConfigValue,
} from '@/features/bots/api'

export interface AdminBot {
  id: string
  ownerUserId: string
  ownerDisplayName: string
  name: string
  status: string
  desiredState: string
  createdAt: string
}

export async function fetchAdminBots(session: Session, query?: string) {
  const url = new URL(`${backendUrl}/api/v2/admin/bots`)
  if (query) url.searchParams.set('query', query)
  return fetchAllCursorPages<AdminBot>(
    url,
    authenticatedHeaders(session, false),
    'Unable to load bots.',
  )
}

export const transferAdminBot = (
  botId: string,
  newOwnerUserId: string,
  keepRunning: boolean,
  session: Session,
) =>
  adminRequest<AdminBot>(
    `/api/v1/admin/bots/${botId}/transfer`,
    session,
    { method: 'POST', body: JSON.stringify({ newOwnerUserId, keepRunning }) },
    'Unable to transfer bot.',
  )

export const controlAdminBot = (
  botId: string,
  action: 'start' | 'stop' | 'restart',
  session: Session,
) =>
  adminRequest<AdminBot>(
    `/api/v1/admin/bots/${botId}/${action}`,
    session,
    { method: 'POST' },
    `Unable to ${action} bot.`,
  )

export const fetchAdminBotSettings = (botId: string, session: Session) =>
  adminRequest<UserBot>(
    `/api/v1/admin/bots/${botId}/settings`,
    session,
    { method: 'GET' },
    'Unable to load bot settings.',
  )

export const updateAdminBotSettings = (
  botId: string,
  input: { name: string; discordApplicationId: string | null; discordGuildId: string | null },
  session: Session,
) =>
  adminRequest<UserBot>(
    `/api/v1/admin/bots/${botId}/settings`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to update bot settings.',
  )

export const fetchAdminBotLicenses = (botId: string, session: Session) =>
  adminRequest<FeatureLicense[]>(
    `/api/v1/admin/bots/${botId}/licenses`,
    session,
    { method: 'GET' },
    'Unable to load bot features.',
  )

export const fetchAdminFeatureConfiguration = (
  botId: string,
  licenseId: string,
  session: Session,
) =>
  adminRequest<FeatureConfiguration>(
    `/api/v1/admin/bots/${botId}/licenses/${licenseId}/configuration`,
    session,
    { method: 'GET' },
    'Unable to load feature settings.',
  )

export const updateAdminFeatureConfiguration = (
  botId: string,
  licenseId: string,
  input: {
    values: Record<string, FeatureConfigValue>
    secrets: Record<string, string>
    presentations: Record<string, Record<string, unknown>>
  },
  session: Session,
) =>
  adminRequest<FeatureConfiguration>(
    `/api/v1/admin/bots/${botId}/licenses/${licenseId}/configuration`,
    session,
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to save feature settings.',
  )
