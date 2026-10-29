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
  categoryId: string
  supportRoleIds: string[]
  autoCloseMinutes: number
  autoCloseMode: 'IDLE' | 'OPENED'
  formEnabled: boolean
  formTitle: string
  fields: TicketField[]
}
export const ticketConfigKeys = new Set(['TICKET_COMMAND_NAME', 'TICKET_CATEGORIES', 'TICKET_DISCORD_HISTORY_ENABLED'])
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const key = (value: unknown) => typeof value === 'string' && /^[a-z0-9_-]{1,32}$/.test(value)
const id = (value: unknown) => typeof value === 'string' && /^\d{15,30}$/.test(value)
const text = (value: unknown, max: number, empty = false) =>
  typeof value === 'string' && value.length <= max && (empty || !!value.trim())

export function validateTicketDraft(values: Record<string, unknown>): boolean {
  if (values.TICKET_DISCORD_HISTORY_ENABLED !== undefined && typeof values.TICKET_DISCORD_HISTORY_ENABLED !== 'boolean') return false
  if (!key(values.TICKET_COMMAND_NAME ?? 'ticket')) return false
  try {
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
    categoryId: '',
    supportRoleIds: [],
    autoCloseMinutes: 0,
    autoCloseMode: 'IDLE',
    formEnabled: false,
    formTitle: label || 'Ticket',
    fields: [],
  }
}
