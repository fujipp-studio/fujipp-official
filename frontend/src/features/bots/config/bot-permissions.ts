export const botPermissionsConfigKeys = new Set(['COMMAND_PERMISSION_RULES'])

export interface CommandPermissionRule extends Record<string, unknown> {
  command: string
  roleIds: string[]
  userIds: string[]
}

export function parseCommandPermissionRules(value: string): CommandPermissionRule[] | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return null
    if (
      parsed.some(
        (item) =>
          !item ||
          typeof item !== 'object' ||
          Array.isArray(item) ||
          typeof item.command !== 'string' ||
          !Array.isArray(item.roleIds) ||
          item.roleIds.some((id: unknown) => typeof id !== 'string') ||
          !Array.isArray(item.userIds) ||
          item.userIds.some((id: unknown) => typeof id !== 'string'),
      )
    )
      return null
    return parsed as CommandPermissionRule[]
  } catch {
    return null
  }
}
