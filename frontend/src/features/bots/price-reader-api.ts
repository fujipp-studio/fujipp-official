import type { Session } from '@supabase/supabase-js'
import { apiFetch, authenticatedHeaders, backendUrl, readJson } from '@/shared/api/http'
import type { GeminiPrice } from '@price-reader/gemini-contract'

export interface PriceReaderTestResult {
  connected: boolean
  errorCode: string | null
  result: GeminiPrice | null
}

export async function testPriceReaderGemini(
  licenseId: string,
  input: { apiKey?: string; model: string; imageBase64?: string; mimeType?: string },
  session: Session,
  signal?: AbortSignal,
  adminBotId?: string,
): Promise<PriceReaderTestResult> {
  const path = adminBotId
    ? `/api/v1/admin/bots/${encodeURIComponent(adminBotId)}/licenses/${encodeURIComponent(licenseId)}`
    : `/api/v1/feature-licenses/${encodeURIComponent(licenseId)}`
  const response = await apiFetch(`${backendUrl}${path}/price-reader/test`, {
    method: 'POST',
    headers: authenticatedHeaders(session, true),
    body: JSON.stringify(input),
    signal,
  })
  return readJson<PriceReaderTestResult>(response, 'Unable to test Gemini.')
}
