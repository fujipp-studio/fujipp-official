export interface TicketField {
  key: string
  label: string
  style: 'SHORT' | 'PARAGRAPH'
  required: boolean
  placeholder: string
}
export interface TicketCategory {
  key: string
  label: string
  description: string
  emoji?: string
  channelNameTemplate?: string
  welcome?: { title: string; description: string; imageUrl: string }
  categoryId: string
  supportRoleIds: string[]
  autoCloseMinutes: number
  autoCloseMode: 'IDLE' | 'OPENED'
  formEnabled: boolean
  formTitle: string
  fields: TicketField[]
}
export const ticketConfigKeys = new Set([
  'TICKET_COMMAND_NAME',
  'TICKET_CATEGORIES',
  'TICKET_DISCORD_HISTORY_ENABLED',
  'TICKET_BEHAVIOR',
])
export type TicketDelivery = 'OFF' | 'COMMAND' | 'BUTTON' | 'BOTH'
export type TicketAction = 'close' | 'schedule' | 'autoClose' | 'addUser' | 'history'
export type TicketActions = Record<TicketAction, TicketDelivery>
export const defaultTicketActions: TicketActions = {
  close: 'BOTH',
  schedule: 'OFF',
  autoClose: 'BOTH',
  addUser: 'BOTH',
  history: 'BOTH',
}
export function readTicketActions(value: unknown): TicketActions {
  if (value === undefined) return { ...defaultTicketActions }
  if (
    !record(value) ||
    Object.keys(value).some((key) => !Object.hasOwn(defaultTicketActions, key)) ||
    Object.values(value).some(
      (mode) => typeof mode !== 'string' || !['OFF', 'COMMAND', 'BUTTON', 'BOTH'].includes(mode),
    )
  )
    throw new Error('Invalid Ticket action options')
  return { ...defaultTicketActions, ...value } as TicketActions
}
export interface TicketBehavior {
  controlStyle?: 'MANAGE' | 'DIRECT'
  actions?: Partial<TicketActions>
  maxOpenPerUser: number
  confirmClose: boolean
  closeRoleIds: string[]
  closeUserIds: string[]
}
export const defaultTicketBehavior: TicketBehavior = {
  maxOpenPerUser: 1,
  confirmClose: true,
  closeRoleIds: [],
  closeUserIds: [],
}
export const validTicketEmoji = (value: unknown) =>
  typeof value === 'string' &&
  (value === '' ||
    /^<a?:[A-Za-z0-9_]{2,32}:\d{15,30}>$/.test(value) ||
    (/^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)$/u.test(
      value,
    ) &&
      value.length <= 32))
export const validTicketName = (value: unknown) =>
  typeof value === 'string' &&
  !!value.trim() &&
  value.length <= 100 &&
  !/[\p{Cc}\p{Cf}/\\]/u.test(value) &&
  !/[{}]/.test(value.replace(/\{\{(username|user_id|topic|id)\}\}/g, ''))
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const key = (value: unknown) => typeof value === 'string' && /^[a-z0-9_-]{1,32}$/.test(value)
const id = (value: unknown) => typeof value === 'string' && /^\d{15,30}$/.test(value)
const text = (value: unknown, max: number, empty = false) =>
  typeof value === 'string' && value.length <= max && (empty || !!value.trim())

export function validateTicketDraft(values: Record<string, unknown>): boolean {
  if (
    values.TICKET_DISCORD_HISTORY_ENABLED !== undefined &&
    typeof values.TICKET_DISCORD_HISTORY_ENABLED !== 'boolean'
  )
    return false
  if (!key(values.TICKET_COMMAND_NAME ?? 'ticket')) return false
  try {
    const behavior: unknown = JSON.parse(
      String(values.TICKET_BEHAVIOR ?? JSON.stringify(defaultTicketBehavior)),
    )
    if (
      !record(behavior) ||
      !Number.isInteger(behavior.maxOpenPerUser) ||
      Number(behavior.maxOpenPerUser) < 1 ||
      Number(behavior.maxOpenPerUser) > 25 ||
      typeof behavior.confirmClose !== 'boolean'
    )
      return false
    for (const [field, max] of [
      ['closeRoleIds', 10],
      ['closeUserIds', 25],
    ] as const) {
      const ids = behavior[field]
      if (
        !Array.isArray(ids) ||
        ids.length > max ||
        !ids.every(id) ||
        new Set(ids).size !== ids.length
      )
        return false
    }
    if (
      behavior.controlStyle !== undefined &&
      (typeof behavior.controlStyle !== 'string' ||
        !['MANAGE', 'DIRECT'].includes(behavior.controlStyle))
    )
      return false
    readTicketActions(behavior.actions)
    const rows: unknown = JSON.parse(String(values.TICKET_CATEGORIES ?? '[]'))
    if (!Array.isArray(rows) || !rows.length || rows.length > 25) return false
    const keys = new Set<string>()
    return rows.every((row) => {
      if (
        !record(row) ||
        !key(row.key) ||
        keys.has(String(row.key)) ||
        !text(row.label, 100) ||
        !text(row.description, 100, true) ||
        !id(row.categoryId) ||
        !Array.isArray(row.supportRoleIds) ||
        row.supportRoleIds.length > 10 ||
        !row.supportRoleIds.every(id) ||
        new Set(row.supportRoleIds).size !== row.supportRoleIds.length ||
        !Number.isInteger(row.autoCloseMinutes) ||
        Number(row.autoCloseMinutes) < 0 ||
        Number(row.autoCloseMinutes) > 43200 ||
        !['IDLE', 'OPENED'].includes(String(row.autoCloseMode)) ||
        typeof row.formEnabled !== 'boolean' ||
        !text(row.formTitle, 45) ||
        !Array.isArray(row.fields) ||
        row.fields.length > 5 ||
        (row.formEnabled && !row.fields.length)
      )
        return false
      keys.add(String(row.key))
      if (
        row.welcome !== undefined &&
        (!record(row.welcome) ||
          !text(row.welcome.title, 256) ||
          !text(row.welcome.description, 3500, true) ||
          !text(row.welcome.imageUrl, 2048, true) ||
          (row.welcome.imageUrl !== '' && !/^https:\/\/[^\s]+$/.test(String(row.welcome.imageUrl))))
      )
        return false
      if (row.emoji !== undefined && !validTicketEmoji(row.emoji)) return false
      if (row.channelNameTemplate !== undefined && !validTicketName(row.channelNameTemplate))
        return false
      const fields = new Set<string>()
      return row.fields.every((field: unknown) => {
        if (
          !record(field) ||
          !key(field.key) ||
          fields.has(String(field.key)) ||
          !text(field.label, 45) ||
          !['SHORT', 'PARAGRAPH'].includes(String(field.style)) ||
          typeof field.required !== 'boolean' ||
          !text(field.placeholder, 100, true)
        )
          return false
        fields.add(String(field.key))
        return true
      })
    })
  } catch {
    return false
  }
}

export function newTicketCategory(key: string, label = ''): TicketCategory {
  return {
    key,
    label,
    description: '',
    emoji: '',
    channelNameTemplate: 'ticket-{{topic}}-{{id}}',
    categoryId: '',
    supportRoleIds: [],
    autoCloseMinutes: 0,
    autoCloseMode: 'IDLE',
    formEnabled: false,
    formTitle: label || 'Ticket',
    fields: [],
  }
}
