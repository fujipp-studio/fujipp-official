import { describe, expect, it } from 'vitest'
import { formatWalletMoney } from '@/features/bots/money-api'

describe('Wallet monetary display', () => {
  it('preserves satang beyond JavaScript Number precision', () => {
    expect(formatWalletMoney('900719925474099199', 'en')).toBe('฿9,007,199,254,740,991.99')
    expect(formatWalletMoney('199500', 'th')).toBe('฿1,995.00')
    expect(formatWalletMoney('5', 'en')).toBe('฿0.05')
    expect(formatWalletMoney(null, 'en')).toBe('—')
  })
})
