import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import WalletBalanceCard from '../features/topup/components/WalletBalanceCard.vue'
import { getWalletSkin, walletSkinTiers } from '../features/topup/config/wallet-skins'
import { i18n } from '../i18n'

afterEach(() => {
  i18n.global.locale.value = 'en'
})

describe('wallet balance skins', () => {
  it('uses the requested baht thresholds, comparing the balance in satang', () => {
    expect(walletSkinTiers.map((tier) => tier.minimumBaht)).toEqual([
      0,
      100,
      500,
      ...Array.from({ length: 19 }, (_, i) => 1000 + i * 500),
    ])
    for (const tier of walletSkinTiers) {
      expect(getWalletSkin(tier.minimumBaht * 100).key).toBe(tier.key)
    }
    for (const [index, tier] of walletSkinTiers.slice(1).entries()) {
      expect(getWalletSkin(tier.minimumBaht * 100 - 1).key).toBe(walletSkinTiers[index]!.key)
    }
    expect(getWalletSkin(37700).key).toBe('green')
    expect(getWalletSkin(10000000).key).toBe('black')
    for (const amount of [-100, NaN, Infinity]) expect(getWalletSkin(amount).key).toBe('classic')
  })

  it('upgrades and downgrades with the current balance while preserving the formatted amount', async () => {
    i18n.global.locale.value = 'en'
    const wrapper = mount(WalletBalanceCard, {
      props: { balanceSatang: 37700, formattedBalance: 'THB 377.00' },
      global: { plugins: [i18n] },
    })
    expect(wrapper.attributes('data-wallet-skin')).toBe('green')
    await wrapper.setProps({ balanceSatang: 1000000, formattedBalance: 'THB 10,000.00' })
    expect(wrapper.attributes('data-wallet-skin')).toBe('black')
    expect(wrapper.get('strong').text()).toBe('THB 10,000.00')
    expect(wrapper.text()).toContain('Black')
    i18n.global.locale.value = 'th'
    await nextTick()
    expect(wrapper.text()).toContain('แบล็ก')
    expect(wrapper.text()).toContain('ระดับ 22')
    await wrapper.setProps({ balanceSatang: 9999, formattedBalance: 'THB 99.99' })
    expect(wrapper.attributes('data-wallet-skin')).toBe('classic')
    wrapper.unmount()
  })
})
