import type { Session } from '@supabase/supabase-js'
import { adminRequest, apiFetch, backendUrl, readJson } from '@/shared/api/http'

export const seasonalEffects = ['NONE', 'HALLOWEEN', 'CHRISTMAS', 'VALENTINE'] as const
export type SeasonalEffect = typeof seasonalEffects[number]
export interface SeasonalSettings { effect: SeasonalEffect; updatedAt: string }

export function normalizeSettings(value: unknown): SeasonalSettings {
  const data = value as Partial<SeasonalSettings> | null
  return {
    effect: seasonalEffects.includes(data?.effect as SeasonalEffect) ? data!.effect! : 'NONE',
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : '',
  }
}

export async function fetchSeasonalSettings(signal?: AbortSignal) {
  const response = await apiFetch(`${backendUrl}/api/v1/site/seasonal-effects`, {
    signal, cache: 'no-cache', headers: { Accept: 'application/json' },
  })
  return normalizeSettings(await readJson<unknown>(response, 'Unable to load seasonal effects.'))
}

export async function fetchAdminSeasonalSettings(session: Session, signal?: AbortSignal) {
  return normalizeSettings(await adminRequest<unknown>(
    '/api/v1/admin/site/seasonal-effects', session, { signal, cache: 'no-store' },
  ))
}

export async function saveSeasonalSettings(effect: SeasonalEffect, session: Session) {
  return normalizeSettings(await adminRequest<unknown>(
    '/api/v1/admin/site/seasonal-effects', session,
    { method: 'PUT', body: JSON.stringify({ effect }) },
  ))
}
