<script setup lang="ts">
import { computed } from 'vue'
import { Wallet } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { getWalletSkin, getWalletSkinColors } from '../config/wallet-skins'
import WalletCardLines from './WalletCardLines.vue'

const props = defineProps<{
  balanceSatang: number
  formattedBalance: string
  holderName?: string | null
}>()
const { t } = useI18n()
const skin = computed(() => getWalletSkin(props.balanceSatang))
const colors = computed(() => getWalletSkinColors(skin.value))
</script>

<template>
  <div
    class="balance-card"
    :data-wallet-skin="skin.key"
    :data-wallet-level="skin.level"
    :data-wallet-edition="skin.edition"
    :style="colors"
    :title="`${t(`topup.walletSkins.names.${skin.key}`)} · ${t('topup.walletSkins.basedOnBalance')}`"
  >
    <WalletCardLines />
    <div class="card-heading">
      <span class="card-brand"
        ><Wallet class="wallet-icon" :size="18" aria-hidden="true" />FUJIPP
        <span class="card-product">{{ t('topup.design.wallet') }}</span></span
      >
      <span class="card-edition">{{ t(`topup.walletSkins.editions.${skin.edition}`) }}</span>
    </div>
    <div class="wallet-balance-copy">
      <span class="wallet-balance-label">{{ t('topup.currentBalance') }}</span>
      <strong class="wallet-balance-amount tabular-nums">{{ formattedBalance }}</strong>
    </div>
    <div class="card-footer">
      <span class="card-holder" :title="holderName || undefined">{{
        holderName || t('topup.design.wallet')
      }}</span>
      <span class="card-level">{{ t('topup.walletSkins.level', { level: skin.level }) }}</span>
    </div>
    <span class="sr-only">{{ t(`topup.walletSkins.names.${skin.key}`) }}</span>
  </div>
</template>

<style scoped>
.balance-card {
  position: relative;
  isolation: isolate;
  display: flex;
  width: 100%;
  max-width: 22rem;
  min-width: 0;
  min-height: 12rem;
  aspect-ratio: 1.586;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-md);
  overflow: hidden;
  padding: var(--space-lg);
  border: 1px solid color-mix(in srgb, var(--wallet-card-ink) 18%, var(--wallet-card-surface));
  border-radius: var(--radius-lg);
  background: var(--wallet-card-surface);
  color: var(--wallet-card-ink);
  box-shadow: var(--effect-shadow-sm);
}
.card-heading,
.card-footer {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
.card-brand {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-semibold);
  letter-spacing: 0.04em;
}
.card-product {
  font-weight: var(--typography-font-weight-regular);
  letter-spacing: normal;
}
.wallet-icon {
  flex: none;
}
.card-edition {
  flex: none;
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-medium);
}
.wallet-balance-copy {
  display: grid;
  min-width: 0;
  gap: var(--space-xs);
}
.wallet-balance-label {
  font-size: var(--font-size-label-small);
}
.wallet-balance-amount {
  overflow-wrap: anywhere;
  font-size: var(--font-size-heading-h1);
  font-weight: var(--typography-font-weight-semibold);
  line-height: var(--line-height-heading);
  letter-spacing: -0.02em;
}
.card-holder {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-medium);
}
.card-level {
  flex: none;
  font-size: var(--font-size-label-small);
}
.balance-card[data-wallet-edition='black'] .card-brand,
.balance-card[data-wallet-edition='black'] .card-edition {
  color: var(--semantic-color-wallet-card-accent-gold);
}
@media (min-width: 64rem) {
  .balance-card {
    width: 22rem;
    flex: none;
  }
}
</style>
