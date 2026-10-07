export const runtimeAlertMilestones = [
  { key: 'RUNTIME_ALERT_7D', label: ['7 days', '7 วัน'] },
  { key: 'RUNTIME_ALERT_3D', label: ['3 days', '3 วัน'] },
  { key: 'RUNTIME_ALERT_1D', label: ['1 day', '1 วัน'] },
  { key: 'RUNTIME_ALERT_1H', label: ['1 hour', '1 ชั่วโมง'] },
] as const

export const runtimeAlertConfigKeys = new Set([
  'RUNTIME_ALERT_DELIVERY',
  'RUNTIME_ALERT_CHANNEL_ID',
  'RUNTIME_ALERT_DM_USER_ID',
  ...runtimeAlertMilestones.map((item) => item.key),
])
