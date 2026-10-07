export interface MessageSet {
  name: string
  presentationSlot: string
}
export const messageSetsConfigKeys = new Set(['MESSAGE_SETS_COMMAND_NAME', 'MESSAGE_SETS'])
export function parseMessageSets(value: string): MessageSet[] {
  try {
    const rows: unknown = JSON.parse(value)
    return Array.isArray(rows)
      ? rows.filter(
          (row): row is MessageSet =>
            !!row &&
            typeof row === 'object' &&
            typeof row.name === 'string' &&
            typeof row.presentationSlot === 'string',
        )
      : []
  } catch {
    return []
  }
}
export function validateMessageSets(sets: MessageSet[]): boolean {
  return (
    sets.length <= 20 &&
    sets.every(
      (set) =>
        set.name.trim().length > 0 &&
        set.name.length <= 100 &&
        set.name === set.name.trim() &&
        /^set_(?:[1-9]|1\d|20)$/.test(set.presentationSlot),
    ) &&
    new Set(sets.map((set) => set.name.toLowerCase())).size === sets.length &&
    new Set(sets.map((set) => set.presentationSlot)).size === sets.length
  )
}
