export const channelMessageTriggerConfigKeys = new Set([
  'CHANNEL_CREATE_RULES',
  'ADMIN_MESSAGE_TRIGGERS',
])

export function parseMessageTriggerRules(value: string): Record<string, unknown>[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item),
        )
      : []
  } catch {
    return []
  }
}
