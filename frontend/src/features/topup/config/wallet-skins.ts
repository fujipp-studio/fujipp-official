const tiers = [
  { key: 'classic', minimumBaht: 0, edition: 'classic', ink: 'light' },
  { key: 'green', minimumBaht: 100, edition: 'classic', ink: 'light' },
  { key: 'forest', minimumBaht: 500, edition: 'classic', ink: 'light' },
  { key: 'emerald', minimumBaht: 1000, edition: 'classic', ink: 'light' },
  { key: 'silver', minimumBaht: 1500, edition: 'silver', ink: 'dark' },
  { key: 'steel', minimumBaht: 2000, edition: 'silver', ink: 'dark' },
  { key: 'titanium', minimumBaht: 2500, edition: 'silver', ink: 'light' },
  { key: 'pearl', minimumBaht: 3000, edition: 'silver', ink: 'dark' },
  { key: 'bronze', minimumBaht: 3500, edition: 'gold', ink: 'light' },
  { key: 'gold', minimumBaht: 4000, edition: 'gold', ink: 'dark' },
  { key: 'amber', minimumBaht: 4500, edition: 'gold', ink: 'light' },
  { key: 'champagne', minimumBaht: 5000, edition: 'gold', ink: 'dark' },
  { key: 'platinum', minimumBaht: 5500, edition: 'platinum', ink: 'dark' },
  { key: 'graphite', minimumBaht: 6000, edition: 'platinum', ink: 'light' },
  { key: 'moonstone', minimumBaht: 6500, edition: 'platinum', ink: 'dark' },
  { key: 'palladium', minimumBaht: 7000, edition: 'platinum', ink: 'dark' },
  { key: 'navy', minimumBaht: 7500, edition: 'black', ink: 'light' },
  { key: 'charcoal', minimumBaht: 8000, edition: 'black', ink: 'light' },
  { key: 'obsidian', minimumBaht: 8500, edition: 'black', ink: 'light' },
  { key: 'carbon', minimumBaht: 9000, edition: 'black', ink: 'light' },
  { key: 'onyx', minimumBaht: 9500, edition: 'black', ink: 'light' },
  { key: 'black', minimumBaht: 10000, edition: 'black', ink: 'light' },
] as const

export const walletSkinTiers = tiers.map((tier, index) => ({ ...tier, level: index + 1 }))

export function getWalletSkin(balanceSatang: number) {
  let selected = walletSkinTiers[0]!
  if (!Number.isFinite(balanceSatang)) return selected
  for (const tier of walletSkinTiers) {
    if (balanceSatang >= tier.minimumBaht * 100) selected = tier
    else break
  }
  return selected
}

export function getWalletSkinColors(skin: ReturnType<typeof getWalletSkin>) {
  return {
    '--wallet-card-surface': `var(--semantic-color-wallet-card-${skin.key})`,
    '--wallet-card-ink': `var(--semantic-color-wallet-card-ink-${skin.ink})`,
  }
}
