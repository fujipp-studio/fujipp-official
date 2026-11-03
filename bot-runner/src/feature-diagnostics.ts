import { safeErrorText } from './features/errors.js';

export type FeatureErrorCategory = 'CONFIGURATION' | 'PERMISSION' | 'TRANSIENT' | 'INTERNAL';

/** Classify failures without retrying the operation that produced them. */
export function featureDiagnostic(error: unknown, fallbackCode = ''): { category: FeatureErrorCategory; message: string } {
  const row = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const cause = row.cause && typeof row.cause === 'object' ? row.cause as Record<string, unknown> : {};
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown feature error';
  const code = String(row.code ?? cause.code ?? fallbackCode);
  const status = Number(row.status ?? row.httpStatus ?? 0);
  const text = `${code} ${message}`;
  let category: FeatureErrorCategory = 'INTERNAL';
  if (/\b(?:50013|50001)\b|missing permissions|missing access|disallowed intents|permission denied|eacces/i.test(text)) category = 'PERMISSION';
  else if (status === 429 || status >= 500 && status <= 599 || /etimedout|econnreset|econnrefused|enotfound|eai_again|fetch failed|socket hang up|timed out|timeout|\b(?:429|502|503|504)\b|temporarily unavailable/i.test(text)) category = 'TRANSIENT';
  else if (/required|must be|invalid|not configured|not bundled|configuration|configur[ea]|unknown channel|unknown role/i.test(text)) category = 'CONFIGURATION';
  return { category, message: safeErrorText(message, 1800) };
}
