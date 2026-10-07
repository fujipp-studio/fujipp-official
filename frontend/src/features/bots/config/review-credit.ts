export const reviewCreditListKeys = new Set(['REVIEW_REACTIONS', 'REVIEW_REPLY_MESSAGES'])
export const reviewCreditConfigKeys = new Set([
  'REVIEW_CHANNEL_ID',
  'REVIEW_COMMAND_NAME',
  'REVIEW_CHANNEL_NAME_TEMPLATE',
  ...reviewCreditListKeys,
  'REVIEW_DELETE_OLD_REPLY',
  'REVIEW_ROLE_ID',
  'REVIEW_COUNT_WEBHOOKS',
])

export function parseReviewList(value: string): string[] {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string'))
    throw new Error('Review Credit lists must contain strings.')
  return parsed as string[]
}
