import { readTicketActions } from '../config/ticket-config'
type Definition = Record<string, unknown>
const record = (value: unknown): value is Definition =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Show the controls appended by the Runner without saving them into the design. */
export function ticketPresentationPreview(
  raw: Definition,
  slotKey: string,
  discordHistory = false,
  behaviorValue: unknown = undefined,
): Definition {
  let behavior: Definition = {}
  try {
    const parsed = typeof behaviorValue === 'string' ? JSON.parse(behaviorValue) : behaviorValue
    if (record(parsed)) behavior = parsed
  } catch {
    /* Use compatible defaults while the draft is invalid. */
  }
  let actions
  try {
    actions = readTicketActions(behavior.actions)
  } catch {
    actions = readTicketActions(undefined)
  }
  const button = (key: keyof typeof actions) =>
    (key !== 'history' || discordHistory) && ['BUTTON', 'BOTH'].includes(actions[key])
  const controls: Definition = {}
  if (slotKey === 'panel') controls.topic_select = { placeholder: 'เลือกหัวข้อเพื่อเปิดตั๋ว' }
  else if ((Object.keys(actions) as Array<keyof typeof actions>).some(button)) {
    if (behavior.controlStyle !== 'DIRECT')
      controls.close_button = { label: 'จัดการตั๋ว', style: 'secondary' }
    else {
      if (button('close')) controls.close_button = { label: 'ปิดตั๋ว', style: 'danger' }
      if (button('schedule')) controls.timer_button = { label: 'ตั้งเวลาปิด', style: 'secondary' }
      if (button('autoClose'))
        controls.exemption_button = { label: 'ยกเว้นปิดอัตโนมัติ', style: 'secondary' }
      if (button('addUser')) controls.member_button = { label: 'เพิ่มสมาชิก', style: 'secondary' }
      if (button('history'))
        controls.history_button = { label: 'อ่านประวัติแชท', style: 'secondary' }
    }
  }
  if (raw.mode !== 'COMPONENTS_V2') return { ...raw, components: controls }
  const source = record(raw.components_v2) ? raw.components_v2 : raw
  return { ...raw, components_v2: { ...source }, components: controls }
}
