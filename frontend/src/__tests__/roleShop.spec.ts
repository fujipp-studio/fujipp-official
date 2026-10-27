import { describe, expect, it } from 'vitest'
import { parseRolePrice, roleShopProductsValid } from '../features/bots/models/role-shop'

describe('Role Shop prices and products', () => {
  const product = { key: 'vip', name: 'VIP', roleId: '123456789012345678', priceSatang: 10025 }
  it('converts THB to integer satang and rejects fractional satang and unsafe amounts', () => {
    expect(parseRolePrice('100.25')).toBe(10025)
    expect(parseRolePrice('0.01')).toBe(1)
    for (const value of ['-1', '1.001', '1e2', '', '0', '999999999999999999999'])
      expect(parseRolePrice(value)).toBe(0)
  })
  it('requires unique role IDs, stable keys and valid names and prices', () => {
    expect(roleShopProductsValid(JSON.stringify([product]))).toBe(true)
    expect(roleShopProductsValid([])).toBe(true)
    for (const value of [
      [product, { ...product, key: 'other' }],
      [{ ...product, name: '' }],
      [{ ...product, priceSatang: 1.5 }],
      [{ ...product, roleId: '123' }],
      'invalid json',
    ])
      expect(roleShopProductsValid(value)).toBe(false)
  })
})
