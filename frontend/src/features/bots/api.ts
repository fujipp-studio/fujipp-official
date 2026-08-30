import { apiFetch } from '@/shared/api/http'
import type { Session } from '@supabase/supabase-js'
import { fetchAllCursorPages, backendUrl, authenticatedHeaders, readJson } from '@/shared/api/http'

export interface UserBot {
  id: string
  name: string
  discordApplicationId: string | null
  discordGuildId: string | null
  discordUsername: string | null
  discordAvatarUrl: string | null
  status: string
  desiredState: 'RUNNING' | 'STOPPED'
  restartRevision: number
  createdAt: string
  updatedAt: string
}

export interface FeatureLicense {
  id: string
  featureProductId: string
  featureCode: string
  featureName: string
  version: string
  latestVersionId: string | null
  latestVersion: string | null
  upgradeAvailable: boolean
  status: string
  installationLimit: number
  acquiredAt: string
  expiresAt: string | null
  installations: Array<{
    id: string
    botId: string
    botName: string
    status: string
    installedAt: string
  }>
}

export type FeatureConfigValue = string | number | boolean | string[] | Record<string, unknown>

export interface FeatureConfiguration {
  licenseId: string
  revision: number
  validatedForBotId: string | null
  fields: Array<{
    key: string
    label: string
    description: string
    type: string
    required: boolean
    secret: boolean
    defaultValue: FeatureConfigValue | null
    value: FeatureConfigValue | null
    configured: boolean
    validation: Record<string, unknown> | null
    ui: Record<string, unknown> | null
  }>
  presentations: Array<{
    slotId: string
    key: string
    label: string
    description: string
    type: string
    availableVariables: string[]
    defaultDefinition: Record<string, unknown>
    overrideDefinition: Record<string, unknown> | null
  }>
}

export async function fetchBots(session: Session, signal?: AbortSignal): Promise<UserBot[]> {
  return fetchAllCursorPages<UserBot>(
    new URL(`${backendUrl}/api/v2/bots`),
    authenticatedHeaders(session),
    'Unable to load your bots.',
    signal,
  )
}

export async function createBot(
  input: { name: string; discordApplicationId: string | null; discordGuildId: string | null },
  session: Session,
): Promise<UserBot> {
  const response = await apiFetch(`${backendUrl}/api/v1/bots`, {
    method: 'POST',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify(input),
  })
  return readJson<UserBot>(response, 'Unable to create this bot.')
}

export async function updateBot(
  botId: string,
  input: { name: string; discordApplicationId: string | null; discordGuildId: string | null },
  session: Session,
): Promise<UserBot> {
  const response = await apiFetch(`${backendUrl}/api/v1/bots/${encodeURIComponent(botId)}`, {
    method: 'PUT',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify(input),
  })
  return readJson<UserBot>(response, 'Unable to update this bot.')
}

export async function updateBotDiscordToken(
  botId: string,
  token: string,
  session: Session,
): Promise<UserBot> {
  const response = await apiFetch(
    `${backendUrl}/api/v1/bots/${encodeURIComponent(botId)}/credentials/discord-token`,
    {
      method: 'PUT',
      headers: authenticatedHeaders(session, true),
      body: JSON.stringify({ token }),
    },
  )
  return readJson<UserBot>(response, 'Unable to update the Discord token.')
}

export async function syncBotDiscordProfile(botId: string, session: Session): Promise<UserBot> {
  const response = await apiFetch(
    `${backendUrl}/api/v1/bots/${encodeURIComponent(botId)}/discord-profile/sync`,
    { method: 'POST', headers: authenticatedHeaders(session) },
  )
  return readJson<UserBot>(response, 'Unable to sync the Discord bot profile.')
}

export async function controlBot(
  botId: string,
  action: 'start' | 'stop' | 'restart',
  session: Session,
): Promise<UserBot> {
  const response = await apiFetch(
    `${backendUrl}/api/v1/bots/${encodeURIComponent(botId)}/${action}`,
    {
      method: 'POST',
      headers: authenticatedHeaders(session),
    },
  )
  return readJson<UserBot>(response, `Unable to ${action} this bot.`)
}

export async function fetchFeatureLicenses(
  session: Session,
  signal?: AbortSignal,
): Promise<FeatureLicense[]> {
  const response = await apiFetch(`${backendUrl}/api/v1/feature-licenses`, {
    signal,
    headers: authenticatedHeaders(session),
  })
  return readJson<FeatureLicense[]>(response, 'Unable to load your items.')
}

export async function installFeatureLicense(
  licenseId: string,
  botId: string,
  session: Session,
): Promise<{ installationId: string }> {
  const response = await apiFetch(
    `${backendUrl}/api/v1/feature-licenses/${encodeURIComponent(licenseId)}/installations`,
    {
      method: 'POST',
      headers: authenticatedHeaders(session, true),
      body: JSON.stringify({ botId }),
    },
  )
  return readJson(response, 'Unable to install this feature.')
}

export async function upgradeFeatureLicense(
  licenseId: string,
  session: Session,
): Promise<FeatureLicense> {
  const response = await apiFetch(
    `${backendUrl}/api/v1/feature-licenses/${encodeURIComponent(licenseId)}/upgrade`,
    {
      method: 'POST',
      headers: authenticatedHeaders(session, true),
    },
  )
  return readJson<FeatureLicense>(response, 'Unable to upgrade this feature.')
}

export async function fetchFeatureConfiguration(licenseId: string, session: Session) {
  const response = await apiFetch(
    `${backendUrl}/api/v1/feature-licenses/${encodeURIComponent(licenseId)}/configuration`,
    { headers: authenticatedHeaders(session) },
  )
  return readJson<FeatureConfiguration>(response, 'Unable to load feature settings.')
}

export async function updateFeatureConfiguration(
  licenseId: string,
  input: {
    values: Record<string, FeatureConfigValue>
    secrets: Record<string, string>
    presentations: Record<string, Record<string, unknown>>
  },
  session: Session,
) {
  const response = await apiFetch(
    `${backendUrl}/api/v1/feature-licenses/${encodeURIComponent(licenseId)}/configuration`,
    {
      method: 'PUT',
      headers: authenticatedHeaders(session, true),
      body: JSON.stringify(input),
    },
  )
  return readJson<FeatureConfiguration>(response, 'Unable to save feature settings.')
}
