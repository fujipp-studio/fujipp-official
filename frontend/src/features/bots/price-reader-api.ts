import type { Session } from '@supabase/supabase-js'
import { apiFetch, authenticatedHeaders, backendUrl, readJson } from '@/shared/api/http'
import type { GeminiPrice } from '@price-reader/gemini-contract'
import type { CountedGeminiPrice } from '@price-reader/counted-pricing'
import type { ClassifiedGeminiPrice } from '@price-reader/classified-pricing'

export interface PriceReaderTestResult {
  connected: boolean
  errorCode: string | null
  result: GeminiPrice | ClassifiedGeminiPrice | CountedGeminiPrice | null
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
