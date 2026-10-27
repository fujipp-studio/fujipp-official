export interface RoleShopProduct {
  key: string
  name: string
  roleId: string
  priceSatang: number
}

export function parseRolePrice(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return 0
  const [baht, decimal = ''] = value.trim().split('.')
  const amount = Number(baht) * 100 + Number(decimal.padEnd(2, '0'))
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0
}

export function roleShopProductsValid(value: unknown): boolean {
  try {
    const rows: unknown = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(rows) || rows.length > 25) return false
    const keys = new Set<string>(),
      roles = new Set<string>()
    return rows.every((row) => {
      if (!row || typeof row !== 'object') return false
      const valid =
        typeof row.key === 'string' &&
        /^[a-z0-9_-]{1,40}$/.test(row.key) &&
        !keys.has(row.key) &&
        typeof row.name === 'string' &&
        Boolean(row.name.trim()) &&
        row.name.length <= 100 &&
        typeof row.roleId === 'string' &&
        /^\d{15,30}$/.test(row.roleId) &&
        !roles.has(row.roleId) &&
        Number.isSafeInteger(row.priceSatang) &&
        row.priceSatang > 0
      keys.add(row.key)
      roles.add(row.roleId)
      return valid
    })
  } catch {
    return false
  }
}
