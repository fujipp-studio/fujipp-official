export const memberSpendingConfigKeys = new Set([
  'SPENDING_DB_USE_OWN',
  'SPENDING_DB_URL',
  'SPENDING_FIRST_ROLE_ID',
  'SPENDING_UPGRADE_TIERS',
  'SPENDING_TIER_STACK',
  'SPENDING_COUNT_ENABLED',
  'SPENDING_UPGRADE_COUNT',
  'SPENDING_TOP1_ROLE_ID',
  'SPENDING_TOP5_ROLE_ID',
  'SPENDING_MONTHLY_ROLES_ENABLED',
  'SPENDING_MONTHLY_TOP1_ROLE_ID',
  'SPENDING_MONTHLY_TOP5_ROLE_ID',
  'SPENDING_MONTHLY_ROLES_RESET',
  'COMMAND_PERMISSION_RULES',
])

export const memberSpendingPresentationCopy: Record<
  string,
  { label: [string, string]; description: [string, string] }
> = {
  first_card: {
    label: ['First purchase', 'เพิ่มยอดครั้งแรก'],
    description: [
      'Sent when spending is added for the first time.',
      'ส่งเมื่อเพิ่มยอดสะสมครั้งแรก',
    ],
  },
  returning_card: {
    label: ['Repeat purchase', 'เพิ่มยอดครั้งถัดไป'],
    description: [
      'Sent when a member returns to spend again.',
      'ส่งเมื่อสมาชิกกลับมาใช้บริการอีกครั้ง',
    ],
  },
  monthly_leaderboard: {
    label: ['Monthly leaderboard', 'อันดับประจำเดือน'],
    description: [
      'Ranks members by spending in the selected month (Thailand time).',
      'แสดงอันดับจากยอดสะสมเดือนที่เลือก ตามเวลาไทย',
    ],
  },
  leaderboard: {
    label: ['Spending leaderboard', 'อันดับยอดสะสม'],
    description: ['Shows members ranked by total spending.', 'แสดงอันดับสมาชิกตามยอดใช้จ่ายสะสม'],
  },
}
