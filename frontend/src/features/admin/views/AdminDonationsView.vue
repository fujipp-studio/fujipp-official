<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { HeartHandshake, Save, Trophy, Users } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import { updateDonationSettings } from '@/features/admin/api/donations'
import { fetchDonationCampaign, type DonationCampaign } from '@/features/donation/api'
import { useAuthStore } from '@/stores'
import {
  AppButton,
  AppSectionIndicator,
  AppTextArea,
  AppTextField,
  AppToast,
} from '@/shared/ui'
import { AdminLayout, AdminPageHeader, AdminPanel } from '../components'

const auth = useAuthStore()
const { session } = storeToRefs(auth)
const { locale, t } = useI18n()
const campaign = ref<DonationCampaign | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const title = ref('')
const description = ref('')
const goalBaht = ref('')
const toastOpen = ref(false)

const sections = computed(() => [
  { id: 'admin-donations-overview', label: t('admin.sections.overview') },
  { id: 'admin-donations-settings', label: t('admin.donations.settings') },
  { id: 'admin-donations-ranking', label: t('admin.donations.ranking') },
])
const validGoal = computed(() => {
  const value = Number(goalBaht.value)
  return Number.isFinite(value) && value >= 0 && value <= 10_000_000
})
const progress = computed(() => {
  if (!campaign.value?.goalSatang) return 0
  return Math.min(100, (campaign.value.raisedSatang / campaign.value.goalSatang) * 100)
})

function money(satang: number) {
  return new Intl.NumberFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(satang / 100)
}

function applyCampaign(value: DonationCampaign) {
  campaign.value = value
  title.value = value.title
  description.value = value.description
  goalBaht.value = String(value.goalSatang / 100)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    applyCampaign(await fetchDonationCampaign())
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin.donations.loadError')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!session.value || !title.value.trim() || !validGoal.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const updated = await updateDonationSettings(
      {
        title: title.value.trim(),
        description: description.value.trim(),
        goalSatang: Math.round(Number(goalBaht.value) * 100),
      },
      session.value,
    )
    applyCampaign(updated)
    toastOpen.value = true
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin.donations.saveError')
  } finally {
    saving.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <AdminLayout>
    <div class="space-y-3xl">
      <AdminPageHeader
        :title="t('admin.donations.title')"
        :description="t('admin.donations.description')"
        :icon="HeartHandshake"
      >
        <template #actions>
          <AppButton class="!w-auto" variant="secondary" :disabled="loading" @click="load">
            {{ t('admin.common.refresh') }}
          </AppButton>
        </template>
      </AdminPageHeader>

      <div
        v-if="error"
        class="rounded-lg border border-error-border bg-error-bg p-md text-error-text"
        role="alert"
      >
        {{ error }}
      </div>

      <section id="admin-donations-overview">
        <AdminPanel
          :title="t('admin.donations.overview')"
          :description="t('admin.donations.overviewDescription')"
        >
          <div v-if="campaign" class="donation-overview-grid">
            <article>
              <HeartHandshake aria-hidden="true" />
              <span>{{ t('admin.donations.raised') }}</span>
              <strong>{{ money(campaign.raisedSatang) }}</strong>
            </article>
            <article>
              <Users aria-hidden="true" />
              <span>{{ t('admin.donations.supporters') }}</span>
              <strong>{{ campaign.supporterCount.toLocaleString() }}</strong>
            </article>
            <article>
              <Trophy aria-hidden="true" />
              <span>{{ t('admin.donations.progress') }}</span>
              <strong>{{ Math.round(progress) }}%</strong>
            </article>
          </div>
          <p v-else class="py-xl text-sm text-text-muted">
            {{ loading ? t('admin.common.loading') : t('admin.common.noData') }}
          </p>
        </AdminPanel>
      </section>

      <section id="admin-donations-settings">
        <AdminPanel
          :title="t('admin.donations.settings')"
          :description="t('admin.donations.settingsDescription')"
        >
          <form class="donation-settings-form" @submit.prevent="save">
            <AppTextField
              v-model="title"
              :label="t('admin.donations.campaignTitle')"
              :placeholder="t('admin.donations.campaignTitlePlaceholder')"
              :maxlength="120"
              required
            />
            <AppTextArea
              v-model="description"
              :label="t('admin.donations.campaignDescription')"
              :placeholder="t('admin.donations.campaignDescriptionPlaceholder')"
              :maxlength="500"
              :rows="4"
            />
            <AppTextField
              v-model="goalBaht"
              input-type="number"
              unit="฿"
              :label="t('admin.donations.goal')"
              :support-text="t('admin.donations.goalHint')"
              :state="validGoal ? 'default' : 'error'"
              required
            />
            <AppButton
              class="tablet:!w-auto"
              type="submit"
              :disabled="!title.trim() || !validGoal"
              :loading="saving"
            >
              <Save class="size-4" aria-hidden="true" />
              {{ saving ? t('admin.donations.saving') : t('admin.donations.save') }}
            </AppButton>
          </form>
        </AdminPanel>
      </section>

      <section id="admin-donations-ranking">
        <AdminPanel
          :title="t('admin.donations.ranking')"
          :description="t('admin.donations.rankingDescription')"
        >
          <ol v-if="campaign?.leaderboard.length" class="admin-leaderboard">
            <li v-for="entry in campaign.leaderboard" :key="`${entry.rank}-${entry.displayName}`">
              <span>{{ entry.rank.toString().padStart(2, '0') }}</span>
              <div>
                <strong>{{ entry.displayName }}</strong>
                <small>{{ t('admin.donations.donationCount', { count: entry.donationCount }) }}</small>
              </div>
              <strong>{{ money(entry.totalSatang) }}</strong>
            </li>
          </ol>
          <p v-else class="py-xl text-sm text-text-muted">{{ t('admin.donations.noRanking') }}</p>
        </AdminPanel>
      </section>

      <AppSectionIndicator :sections="sections" :aria-label="t('admin.sections.navigation')" />
      <AppToast
        v-model:open="toastOpen"
        :message="t('admin.donations.saved')"
        variant="success"
      />
    </div>
  </AdminLayout>
</template>

<style scoped>
.donation-overview-grid { display:grid; gap:var(--spacing-md); }
.donation-overview-grid article { display:grid; grid-template-columns:auto 1fr; align-items:center; gap:var(--spacing-xs) var(--spacing-sm); padding:var(--spacing-lg); border:1px solid var(--color-border-subtle); border-radius:var(--radius-lg); background:var(--color-bg-elevated); }
.donation-overview-grid svg { grid-row:span 2; width:var(--icon-size-32); height:var(--icon-size-32); color:var(--color-text-muted); }.donation-overview-grid span { color:var(--color-text-secondary); font-size:var(--font-size-label-small); }.donation-overview-grid strong { font-size:var(--font-size-heading-h2); }
.donation-settings-form { display:grid; max-width:44rem; gap:var(--spacing-lg); }
.admin-leaderboard { border-top:1px solid var(--color-border-default); }.admin-leaderboard li { display:grid; grid-template-columns:3rem minmax(0,1fr) auto; align-items:center; gap:var(--spacing-md); min-height:4.5rem; border-bottom:1px solid var(--color-border-default); }.admin-leaderboard > li > span { color:var(--color-text-muted); font-family:var(--font-family-mono); font-size:var(--font-size-label-small); }.admin-leaderboard div { display:grid; min-width:0; gap:var(--spacing-xxs); }.admin-leaderboard div strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.admin-leaderboard small { color:var(--color-text-muted); }
@media (min-width:48rem) { .donation-overview-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
</style>
