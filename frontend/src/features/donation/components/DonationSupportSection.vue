<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ChevronLeft, ChevronRight, Heart, LockKeyhole, WalletCards } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  createDonation,
  fetchDonationCampaign,
  type Donation,
  type DonationCampaign,
} from '@/features/donation/api'
import { AppAuthDialog, AppButton, AppModal, AppTextField, AppToast } from '@/shared/ui'
import { useAuthStore } from '@/stores'

const pageSize = 5
const presets = [50, 100, 300, 500, 1000]
const auth = useAuthStore()
const { currentUser, session } = storeToRefs(auth)
const { locale, t } = useI18n()
const route = useRoute()
const router = useRouter()

const campaign = ref<DonationCampaign | null>(null)
const loading = ref(true)
const error = ref('')
const leaderboardPage = ref(1)
const authDialogOpen = ref(false)
const donationModalOpen = ref(false)
const openAfterLogin = ref(false)
const selectedAmount = ref(100)
const customAmount = ref('')
const donorName = ref('')
const anonymous = ref(false)
const creating = ref(false)
const completedDonation = ref<Donation | null>(null)
const toastOpen = ref(false)
const toastMessage = ref('')
const toastVariant = ref<'success' | 'error'>('success')

const amountBaht = computed(() => {
  const custom = Number(customAmount.value)
  return customAmount.value.trim() && Number.isFinite(custom) ? custom : selectedAmount.value
})
const amountSatang = computed(() => Math.round(amountBaht.value * 100))
const balanceSatang = computed(() => currentUser.value?.walletBalanceSatang ?? 0)
const validAmount = computed(
  () => Number.isInteger(amountBaht.value) && amountBaht.value >= 10 && amountBaht.value <= 100000,
)
const walletEnough = computed(() => balanceSatang.value >= amountSatang.value)
const canDonate = computed(
  () =>
    Boolean(session.value) &&
    validAmount.value &&
    (anonymous.value || donorName.value.trim().length > 0) &&
    walletEnough.value,
)
const progress = computed(() => {
  if (!campaign.value?.goalSatang) return 0
  return Math.min(100, (campaign.value.raisedSatang / campaign.value.goalSatang) * 100)
})
const remainingSatang = computed(() => {
  if (!campaign.value?.goalSatang) return 0
  return Math.max(0, campaign.value.goalSatang - campaign.value.raisedSatang)
})
const totalPages = computed(() =>
  Math.max(1, Math.ceil((campaign.value?.leaderboard.length ?? 0) / pageSize)),
)
const visibleLeaderboard = computed(() => {
  const start = (leaderboardPage.value - 1) * pageSize
  return campaign.value?.leaderboard.slice(start, start + pageSize) ?? []
})

function money(satang: number) {
  return new Intl.NumberFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(satang / 100)
}

function openDonation() {
  if (session.value) {
    donationModalOpen.value = true
    return
  }
  openAfterLogin.value = true
  authDialogOpen.value = true
}

function choosePreset(amount: number) {
  selectedAmount.value = amount
  customAmount.value = ''
}

function updateCustomAmount(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '')
  input.value = digits
  customAmount.value = digits
}

function changePage(page: number) {
  leaderboardPage.value = Math.min(Math.max(page, 1), totalPages.value)
}

async function loadCampaign() {
  loading.value = true
  error.value = ''
  try {
    campaign.value = await fetchDonationCampaign()
    leaderboardPage.value = Math.min(leaderboardPage.value, totalPages.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('donation.campaignLoadError')
  } finally {
    loading.value = false
  }
}

async function donateFromWallet() {
  if (!session.value || !canDonate.value || creating.value) return
  creating.value = true
  try {
    completedDonation.value = await createDonation(
      {
        amountSatang: amountSatang.value,
        donorName: donorName.value.trim(),
        message: '',
        anonymous: anonymous.value,
        fundingMethod: 'WALLET',
        idempotencyKey: `web-donation:${crypto.randomUUID()}`,
      },
      session.value,
    )
    toastMessage.value = t('donation.successToast')
    toastVariant.value = 'success'
    toastOpen.value = true
    await Promise.allSettled([auth.reloadCurrentUser(), loadCampaign()])
  } catch (cause) {
    toastMessage.value = cause instanceof Error ? cause.message : t('donation.createError')
    toastVariant.value = 'error'
    toastOpen.value = true
  } finally {
    creating.value = false
  }
}

async function goToTopup() {
  donationModalOpen.value = false
  await router.push({
    path: '/add-credit',
    query: route.query.locale === 'th' ? { locale: 'th' } : {},
  })
}

function resetDonation() {
  completedDonation.value = null
  selectedAmount.value = 100
  customAmount.value = ''
}

watch(
  currentUser,
  (user) => {
    if (!donorName.value && user) donorName.value = user.displayName ?? user.username ?? ''
  },
  { immediate: true },
)

watch(session, (activeSession) => {
  if (!activeSession || !openAfterLogin.value) return
  openAfterLogin.value = false
  authDialogOpen.value = false
  donationModalOpen.value = true
})

onMounted(() => void loadCampaign())
</script>

<template>
  <section id="about-support" class="donation-support-section" aria-labelledby="support-title">
    <div v-if="loading" class="support-state" aria-live="polite">{{ t('donation.loading') }}</div>

    <div v-else-if="error || !campaign" class="support-state" role="alert">
      <span>{{ error || t('donation.campaignLoadError') }}</span>
      <AppButton class="support-state__button" variant="primary" @click="loadCampaign">
        {{ t('donation.retry') }}
      </AppButton>
    </div>

    <div v-else class="support-layout">
      <div class="leaderboard-panel">
        <header class="support-header">
          <h2 id="support-title">{{ t('donation.ranking') }}</h2>
          <span>{{ campaign.supporterCount }} {{ t('donation.supporters') }}</span>
        </header>

        <div class="leaderboard-table-wrap">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th scope="col">{{ t('donation.rankColumn') }}</th>
                <th scope="col">{{ t('donation.supporterColumn') }}</th>
                <th scope="col">{{ t('donation.donationsColumn') }}</th>
                <th scope="col">{{ t('donation.totalColumn') }}</th>
              </tr>
            </thead>
            <tbody v-if="visibleLeaderboard.length">
              <tr v-for="entry in visibleLeaderboard" :key="`${entry.rank}-${entry.displayName}`">
                <td>
                  <span class="rank" :data-top="entry.rank <= 3 ? entry.rank : undefined">
                    {{ entry.rank.toString().padStart(2, '0') }}
                  </span>
                </td>
                <td><strong>{{ entry.displayName }}</strong></td>
                <td>{{ entry.donationCount }}</td>
                <td>{{ money(entry.totalSatang) }}</td>
              </tr>
            </tbody>
          </table>

          <p v-if="!visibleLeaderboard.length" class="leaderboard-empty">
            {{ t('donation.leaderboardEmpty') }}
          </p>
        </div>

        <nav class="pagination" :aria-label="t('donation.paginationLabel')">
          <button
            type="button"
            :aria-label="t('donation.previousPage')"
            :disabled="leaderboardPage === 1"
            @click="changePage(leaderboardPage - 1)"
          >
            <ChevronLeft :size="18" aria-hidden="true" />
          </button>
          <span>{{ leaderboardPage }} / {{ totalPages }}</span>
          <button
            type="button"
            :aria-label="t('donation.nextPage')"
            :disabled="leaderboardPage === totalPages"
            @click="changePage(leaderboardPage + 1)"
          >
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </nav>
      </div>

      <aside class="goal-panel">
        <span class="goal-label">{{ t('donation.goal') }}</span>
        <strong class="goal-value">{{ money(campaign.goalSatang) }}</strong>

        <div
          class="goal-track"
          role="progressbar"
          :aria-label="t('donation.goalProgress')"
          :aria-valuenow="Math.round(progress)"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span :style="{ width: `${progress}%` }" />
        </div>

        <div class="goal-progress-copy">
          <strong>{{ money(campaign.raisedSatang) }}</strong>
          <span>{{ Math.round(progress) }}%</span>
        </div>

        <dl class="goal-facts">
          <div>
            <dt>{{ t('donation.raised') }}</dt>
            <dd>{{ money(campaign.raisedSatang) }}</dd>
          </div>
          <div>
            <dt>{{ t('donation.remaining') }}</dt>
            <dd>{{ money(remainingSatang) }}</dd>
          </div>
        </dl>

        <AppButton class="donate-button" variant="primary" @click="openDonation">
          <Heart :size="18" aria-hidden="true" />
          {{ t('donation.dashboardDonate') }}
        </AppButton>
        <small v-if="!session" class="login-note">
          <LockKeyhole :size="14" aria-hidden="true" />
          {{ t('donation.loginRequiredShort') }}
        </small>
      </aside>
    </div>

    <AppModal
      v-model:open="donationModalOpen"
      :title="t('donation.modalTitle')"
      size="md"
      :disabled="creating"
    >
      <div v-if="completedDonation?.status === 'SUCCESS'" class="donation-success">
        <Heart :size="36" aria-hidden="true" />
        <strong>{{ t('donation.successTitle') }}</strong>
        <span>{{ money(completedDonation.amountSatang) }}</span>
        <AppButton variant="primary" @click="resetDonation">{{ t('donation.donateAgain') }}</AppButton>
      </div>

      <div v-else class="donation-form">
        <div class="wallet-balance">
          <span><WalletCards :size="18" aria-hidden="true" />{{ t('donation.walletBalance') }}</span>
          <strong>{{ money(balanceSatang) }}</strong>
        </div>

        <div class="amount-options" role="group" :aria-label="t('donation.presetAmounts')">
          <button
            v-for="amount in presets"
            :key="amount"
            type="button"
            :class="{ 'amount-option--active': !customAmount && selectedAmount === amount }"
            @click="choosePreset(amount)"
          >
            ฿{{ amount.toLocaleString(locale === 'th' ? 'th-TH' : 'en-US') }}
          </button>
        </div>

        <label class="custom-amount">
          <span>{{ t('donation.customAmount') }}</span>
          <span class="custom-amount__input">
            <span aria-hidden="true">฿</span>
            <input
              :value="customAmount"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              :placeholder="t('donation.customAmountPlaceholder')"
              @input="updateCustomAmount"
            />
          </span>
        </label>

        <AppTextField
          v-model="donorName"
          :label="t('donation.donorName')"
          :placeholder="t('donation.donorNamePlaceholder')"
          :maxlength="60"
          :required="!anonymous"
          :disabled="anonymous"
        />

        <label class="anonymous-option">
          <input v-model="anonymous" type="checkbox" />
          <span>{{ t('donation.anonymous') }}</span>
        </label>

        <AppButton
          v-if="validAmount && !walletEnough"
          class="modal-action"
          variant="primary"
          @click="goToTopup"
        >
          {{ t('donation.goToTopup') }}
        </AppButton>
        <AppButton
          v-else
          class="modal-action"
          :disabled="!canDonate"
          :loading="creating"
          variant="primary"
          @click="donateFromWallet"
        >
          {{ t('donation.donateFromWallet') }}
        </AppButton>
      </div>
    </AppModal>

    <AppAuthDialog v-model:open="authDialogOpen" mode="login" />
    <AppToast v-model:open="toastOpen" :message="toastMessage" :variant="toastVariant" />
  </section>
</template>

<style scoped>
.donation-support-section {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--layout-content-max-width);
  min-height: calc(100dvh - 4rem);
  margin-inline: auto;
  padding: var(--space-4xl) var(--layout-page-gutter);
}

.support-layout {
  display: grid;
  width: min(100%, 66rem);
  min-height: 34rem;
  grid-template-columns: minmax(0, 1fr) minmax(17rem, 20rem);
  margin-inline: auto;
  border-block: 1px solid var(--color-border-strong);
}

.leaderboard-panel {
  display: grid;
  min-width: 0;
  grid-template-rows: auto 1fr auto;
  padding: var(--space-2xl) var(--space-2xl) var(--space-2xl) 0;
}

.support-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
  padding-bottom: var(--space-xl);
}

.support-header h2 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.5rem);
  font-weight: var(--typography-font-weight-medium);
  line-height: 1;
  letter-spacing: -0.045em;
}

.support-header > span {
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-label-small);
}

.leaderboard-table-wrap {
  min-width: 0;
  overflow-x: auto;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.leaderboard-table th {
  padding: 0 var(--space-sm) var(--space-sm);
  border-bottom: 1px solid var(--color-border-default);
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-medium);
  text-transform: uppercase;
}

.leaderboard-table th:first-child,
.leaderboard-table td:first-child {
  width: 4rem;
  padding-left: 0;
}

.leaderboard-table th:last-child,
.leaderboard-table td:last-child {
  padding-right: 0;
  text-align: right;
}

.leaderboard-table td {
  height: 4.5rem;
  padding: var(--space-sm);
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-secondary);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-body-small);
}

.leaderboard-table td:nth-child(2) {
  font-family: var(--font-family-sans);
}

.leaderboard-table td:nth-child(2) strong {
  color: var(--color-text-primary);
  font-size: var(--font-size-body-medium);
  font-weight: var(--typography-font-weight-medium);
}

.leaderboard-table td:last-child {
  color: var(--color-text-primary);
  font-size: var(--font-size-body-medium);
  font-weight: var(--typography-font-weight-medium);
  white-space: nowrap;
}

.rank {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
}

.rank[data-top] {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

.leaderboard-empty {
  display: grid;
  min-height: 18rem;
  place-items: center;
  margin: 0;
  color: var(--color-text-muted);
  text-align: center;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xs);
  padding-top: var(--space-xl);
}

.pagination button {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
}

.pagination button:disabled {
  color: var(--color-text-disabled);
  cursor: default;
}

.pagination button:focus-visible {
  border-color: var(--color-border-strong);
  outline: 2px solid var(--color-border-strong);
  outline-offset: 2px;
}

.pagination span {
  min-width: 3.5rem;
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-label-small);
  text-align: center;
}

.goal-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-left: 1px solid var(--color-border-default);
  padding: var(--space-2xl) 0 var(--space-2xl) var(--space-2xl);
}

.goal-label {
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-label-small);
  text-transform: uppercase;
}

.goal-value {
  margin-top: var(--space-xs);
  font-family: var(--font-family-mono);
  font-size: clamp(2rem, 3vw, 2.5rem);
  font-weight: var(--typography-font-weight-medium);
  line-height: 1;
  letter-spacing: -0.06em;
  overflow-wrap: normal;
  white-space: nowrap;
}

.goal-track {
  height: 0.65rem;
  margin-top: var(--space-3xl);
  overflow: hidden;
  background: var(--color-border-subtle);
}

.goal-track span {
  display: block;
  min-width: 0.65rem;
  height: 100%;
  background: var(--color-bg-inverse);
}

.goal-progress-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding-top: var(--space-xs);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-label-small);
}

.goal-progress-copy span {
  color: var(--color-text-primary);
}

.goal-facts {
  display: grid;
  gap: var(--space-sm);
  margin: var(--space-2xl) 0 auto;
  padding: 0;
}

.goal-facts div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-border-subtle);
}

.goal-facts dt {
  color: var(--color-text-muted);
  font-size: var(--font-size-label-small);
}

.goal-facts dd {
  margin: 0;
  color: var(--color-text-primary);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-label-large);
}

:deep(.donate-button),
:deep(.modal-action) {
  border-radius: var(--radius-sm);
  box-shadow: none;
}

.login-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xxs);
  padding-top: var(--space-xs);
  color: var(--color-text-muted);
  font-size: var(--font-size-label-small);
}

.support-state {
  display: grid;
  min-height: 30rem;
  place-items: center;
  align-content: center;
  gap: var(--space-md);
  color: var(--color-text-muted);
}

:deep(.support-state__button) {
  width: auto;
}

.donation-form,
.donation-success {
  display: grid;
  gap: var(--space-lg);
}

.wallet-balance {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-surface);
}

.wallet-balance span {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-text-secondary);
  font-size: var(--font-size-body-small);
}

.wallet-balance strong {
  color: var(--color-text-primary);
  font-family: var(--font-family-mono);
}

.amount-options {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-xs);
}

.amount-options button {
  min-width: 0;
  padding: var(--space-sm) var(--space-xs);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-family: var(--font-family-mono);
}

.amount-options button:hover,
.amount-options button:focus-visible,
.amount-options .amount-option--active {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
  outline: none;
}

.amount-options .amount-option--active {
  background: var(--color-bg-surface-selected);
}

.custom-amount {
  display: grid;
  gap: var(--space-xs);
  color: var(--color-text-primary);
  font-size: var(--font-size-label-large);
}

.custom-amount__input {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
}

.custom-amount__input > span {
  padding-left: var(--space-md);
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
}

.custom-amount input {
  width: 100%;
  min-width: 0;
  padding: var(--space-sm) var(--space-md);
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-body-large);
}

.anonymous-option {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-body-small);
}

.anonymous-option input {
  accent-color: var(--color-bg-inverse);
}

.donation-success {
  justify-items: center;
  padding-block: var(--space-2xl);
  color: var(--color-text-secondary);
  text-align: center;
}

.donation-success svg {
  color: var(--color-text-primary);
}

.donation-success strong {
  color: var(--color-text-primary);
  font-size: var(--font-size-heading-medium);
}

.donation-success > span {
  color: var(--color-text-primary);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-heading-small);
}

@media (max-width: 63.99rem) {
  .support-layout {
    grid-template-columns: minmax(0, 1fr) minmax(15rem, 17rem);
  }

  .leaderboard-panel {
    padding-right: var(--space-xl);
  }

  .goal-panel {
    padding-left: var(--space-xl);
  }
}

@media (max-width: 47.99rem) {
  .donation-support-section {
    min-height: auto;
    padding-block: var(--space-5xl);
  }

  .support-layout {
    grid-template-columns: 1fr;
  }

  .leaderboard-panel {
    padding-right: 0;
  }

  .goal-panel {
    border-top: 1px solid var(--color-border-default);
    border-left: 0;
    padding-left: 0;
  }

  .goal-facts {
    margin-bottom: var(--space-2xl);
  }

  .leaderboard-table th:nth-child(3),
  .leaderboard-table td:nth-child(3) {
    display: none;
  }

  .amount-options {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
