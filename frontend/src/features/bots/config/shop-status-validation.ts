import type { ShopPermissionRule } from './shop-status'

export function parseShopRules(value: string): ShopPermissionRule[] {
  try {
    const rows: unknown = JSON.parse(value)
    return Array.isArray(rows)
      ? rows.filter(
          (row): row is ShopPermissionRule =>
            !!row &&
            typeof row === 'object' &&
            typeof row.channelId === 'string' &&
            typeof row.roleId === 'string' &&
            !!row.open &&
            typeof row.open === 'object' &&
            !Array.isArray(row.open) &&
            !!row.close &&
            typeof row.close === 'object' &&
            !Array.isArray(row.close),
        )
      : []
  } catch {
    return []
  }
}

export function validateShopDraft(values: Record<string, unknown>): boolean {
  const command = (key: string, fallback: string) => values[key] ?? fallback
  if (
    ![
      command('SHOP_COMMAND_NAME', 'shop'),
      command('SHOP_OPEN_COMMAND', 'open'),
      command('SHOP_CLOSE_COMMAND', 'close'),
    ].every((name) => typeof name === 'string' && /^[a-z0-9_-]{1,32}$/.test(name))
  )
    return false
  if (command('SHOP_OPEN_COMMAND', 'open') === command('SHOP_CLOSE_COMMAND', 'close')) return false
  if (!/^(?:\d{15,30})?$/.test(String(values.SHOP_ANNOUNCEMENT_CHANNEL_ID ?? ''))) return false
  for (const state of ['OPEN', 'CLOSE']) {
    for (const kind of ['EVERYONE', 'ROLE']) {
      const allowMentions = values[`SHOP_${state}_ALLOW_${kind}_MENTIONS`]
      if (allowMentions !== undefined && typeof allowMentions !== 'boolean') return false
    }
    const channelName = values[`SHOP_${state}_CHANNEL_NAME`] ?? ''
    if (
      typeof channelName !== 'string' ||
      channelName.length > 100 ||
      (channelName !== '' && (!channelName.trim() || /[\r\n\t]/.test(channelName)))
    )
      return false
    const delivery = values[`SHOP_${state}_DELIVERY_MODE`] ?? 'NEW'
    if (typeof delivery !== 'string' || !['NEW', 'UPDATE', 'REPLACE'].includes(delivery))
      return false
    const mode = values[`SHOP_${state}_MESSAGE_TYPE`] ?? 'DESIGNED'
    if (!['TEXT', 'DESIGNED'].includes(String(mode))) return false
    const text = values[`SHOP_${state}_TEXT`] ?? (state === 'OPEN' ? 'เปิดร้านแล้ว' : 'ปิดร้านแล้ว')
    if (typeof text !== 'string' || text.length > 2000 || (mode === 'TEXT' && !text.trim()))
      return false
  }
  let rules: unknown
  try {
    rules = JSON.parse(String(values.SHOP_PERMISSION_RULES ?? '[]'))
  } catch {
    return false
  }
  if (!Array.isArray(rules) || rules.length > 25) return false
  const pairs = new Set<string>()
  return rules.every((rule) => {
    if (
      !rule ||
      typeof rule !== 'object' ||
      typeof rule.channelId !== 'string' ||
      typeof rule.roleId !== 'string' ||
      !/^\d{15,30}$/.test(rule.channelId) ||
      !/^\d{15,30}$/.test(rule.roleId)
    )
      return false
    const pair = `${rule.channelId}/${rule.roleId}`
    if (pairs.has(pair)) return false
    pairs.add(pair)
    return ['open', 'close'].every((state) => {
      const settings = rule[state]
      return (
        settings &&
        typeof settings === 'object' &&
        !Array.isArray(settings) &&
        Object.entries(settings).every(
          ([key, setting]) =>
            ['ViewChannel', 'SendMessages', 'Connect'].includes(key) &&
            typeof setting === 'string' &&
            ['KEEP', 'ALLOW', 'DENY', 'INHERIT'].includes(setting),
        )
      )
    })
  })
}
