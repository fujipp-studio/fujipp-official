type Definition = Record<string, unknown>
const record = (value: unknown): value is Definition =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Show the controls appended by the Runner without saving them into the design. */
export function ticketPresentationPreview(
  raw: Definition,
  slotKey: string,
  _discordHistory = false,
): Definition {
  const controls =
    slotKey === 'panel'
      ? { topic_select: { placeholder: 'เลือกหัวข้อเพื่อเปิดตั๋ว' } }
      : { close_button: { label: 'จัดการตั๋ว', style: 'secondary' } }
  if (raw.mode !== 'COMPONENTS_V2') return { ...raw, components: controls }
  const source = record(raw.components_v2) ? raw.components_v2 : raw
  return { ...raw, components_v2: { ...source }, components: controls }
}
