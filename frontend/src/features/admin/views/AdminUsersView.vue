<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useCursorCollection } from '@/shared/api/useCursorCollection'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Users, RefreshCw, Search, WalletCards, Settings, Blocks, Trash2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import {
  AppButton,
  AppModal,
  AppSectionIndicator,
  AppTextField,
  AppToast,
} from '../../../shared/ui'
import { useAuthStore } from '../../../stores'
import {
  adjustUserWallet,
  fetchAdminUserFeatures,
  fetchAdminUsersPage,
  fetchUserWalletHistory,
  grantAdminUserFeature,
  updateAdminUser,
  updateAdminUserFeature,
  removeAdminUserFeature,
  type AdminAccountRole,
  type AdminAccountStatus,
  type AdminFeatureLicense,
  type AdminUserSummary,
  type AdminWalletHistoryEntry,
} from '@/features/admin/api/users'
import { fetchAdminFeatures, type AdminFeature } from '@/features/admin/api/features'
import { AdminLayout, AdminPageHeader, AdminPanel, AdminStatusBadge } from '../components'
const auth = useAuthStore()
const { session } = storeToRefs(auth)
const catalog = ref<AdminFeature[]>([]),
  loading = ref(false),
  saving = ref(false),
  error = ref(''),
  query = ref(''),
  toast = ref('')
const { t } = useI18n()
const sections = computed(() => [{ id: 'admin-users-list', label: t('admin.sections.list') }])
const selected = ref<AdminUserSummary | null>(null),
  mode = ref<'account' | 'wallet' | 'features' | 'history' | null>(null),
  licenses = ref<AdminFeatureLicense[]>([])
const removeTarget = ref<AdminFeatureLicense | null>(null)
const featureError = ref('')
const featuresLoading = ref(false)
let featureLoadGeneration = 0
const visibleLicenses = computed(() =>
  licenses.value.filter((license) => license.status !== 'REVOKED'),
)
const installedCore = (license: AdminFeatureLicense) =>
  license.installationCount > 0 &&
  ['bot-presence', 'bot-permissions', 'runtime-expiry-alert'].includes(license.featureCode)
let loadedQuery = ''
const userPages = useCursorCollection<AdminUserSummary>(
  (cursor, signal) => fetchAdminUsersPage(session.value!, loadedQuery, cursor, signal),
  (item) => item.userId ?? item.customerId,
)
const historyPages = useCursorCollection<AdminWalletHistoryEntry>(
  (cursor, signal) =>
    fetchUserWalletHistory(
      selected.value!.customerId || selected.value!.userId!,
      session.value!,
      cursor,
      signal,
    ),
  (item) => item.id,
)
const { items: users, sentinel: usersSentinel } = userPages
const { items: history, sentinel: historySentinel, error: historyError } = historyPages
watch(userPages.error, (value) => {
  if (value) error.value = value
})
const account = ref({
    displayName: '',
    firstName: '',
    lastName: '',
    role: 'USER',
    status: 'ACTIVE',
  }),
  wallet = ref({ direction: 'CREDIT', entryType: 'ADJUSTMENT', amount: '', description: '' }),
  grant = ref({ featureId: '', limit: '1', expiresAt: '' })
async function load() {
  if (!session.value) return
  loading.value = true
  loadedQuery = query.value.trim()
  error.value = ''
  try {
    await Promise.all([
      userPages.reset(),
      catalog.value.length
        ? Promise.resolve()
        : fetchAdminFeatures(session.value).then((value) => {
            catalog.value = value
          }),
    ])
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.page.loadError')
  } finally {
    loading.value = false
  }
}
function openAccount(x: AdminUserSummary) {
  selected.value = x
  mode.value = 'account'
  account.value = {
    displayName: x.displayName ?? '',
    firstName: '',
    lastName: '',
    role: x.role,
    status: x.status,
  }
}
function openWallet(x: AdminUserSummary) {
  selected.value = x
  mode.value = 'wallet'
  wallet.value = { direction: 'CREDIT', entryType: 'ADJUSTMENT', amount: '', description: '' }
}
async function openFeatures(x: AdminUserSummary) {
  if (!session.value || !x.userId || saving.value) return
  const generation = ++featureLoadGeneration
  selected.value = x
  mode.value = 'features'
  licenses.value = []
  featureError.value = ''
  removeTarget.value = null
  featuresLoading.value = true
  grant.value = { featureId: catalog.value[0]?.id ?? '', limit: '1', expiresAt: '' }
  try {
    const result = await fetchAdminUserFeatures(x.userId, session.value)
    if (
      generation === featureLoadGeneration &&
      selected.value?.userId === x.userId &&
      mode.value === 'features'
    )
      licenses.value = result
  } catch (e) {
    if (
      generation === featureLoadGeneration &&
      selected.value?.userId === x.userId &&
      mode.value === 'features'
    )
      featureError.value = e instanceof Error ? e.message : t('admin.page.loadError')
  } finally {
    if (
      generation === featureLoadGeneration &&
      selected.value?.userId === x.userId &&
      mode.value === 'features'
    )
      featuresLoading.value = false
  }
}
async function openHistory(x: AdminUserSummary) {
  if (!session.value) return
  selected.value = x
  mode.value = 'history'
  await historyPages.reset()
}
function close() {
  if (saving.value) return
  resetSelection()
}
function resetSelection() {
  historyPages.cancel()
  featureLoadGeneration++
  removeTarget.value = null
  featureError.value = ''
  selected.value = null
  mode.value = null
}
async function saveAccount() {
  if (!session.value || !selected.value?.userId) return
  saving.value = true
  try {
    await updateAdminUser(
      selected.value.userId,
      {
        displayName: account.value.displayName,
        firstName: account.value.firstName,
        lastName: account.value.lastName,
        role: account.value.role as AdminAccountRole,
        status: account.value.status as AdminAccountStatus,
      },
      session.value,
    )
    toast.value = t('admin.page.accountSaved')
    resetSelection()
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    saving.value = false
  }
}
async function saveWallet() {
  if (!session.value || !selected.value) return
  saving.value = true
  try {
    await adjustUserWallet(
      selected.value.customerId || selected.value.userId!,
      {
        direction: wallet.value.direction as 'CREDIT' | 'DEBIT',
        entryType: wallet.value.entryType,
        amountSatang: Math.round(Number(wallet.value.amount) * 100),
        description: wallet.value.description || undefined,
        idempotencyKey: `admin-ui:${crypto.randomUUID()}`,
      },
      session.value,
    )
    toast.value = t('admin.page.walletSaved')
    resetSelection()
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    saving.value = false
  }
}
async function grantFeature() {
  if (!session.value || !selected.value?.userId || saving.value || featuresLoading.value) return
  saving.value = true
  featureError.value = ''
  try {
    await grantAdminUserFeature(
      selected.value.userId,
      {
        featureProductId: grant.value.featureId,
        installationLimit: Number(grant.value.limit),
        expiresAt: grant.value.expiresAt
          ? new Date(grant.value.expiresAt).toISOString()
          : undefined,
      },
      session.value,
    )
    licenses.value = await fetchAdminUserFeatures(selected.value.userId, session.value)
    toast.value = t('admin.page.featureGranted')
  } catch (e) {
    featureError.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    saving.value = false
  }
}
async function toggleLicense(x: AdminFeatureLicense) {
  if (!session.value || !selected.value?.userId || saving.value || featuresLoading.value) return
  saving.value = true
  featureError.value = ''
  try {
    const updated = await updateAdminUserFeature(
      selected.value.userId,
      x.id,
      {
        status: x.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
        installationLimit: x.installationLimit,
        expiresAt: x.expiresAt,
      },
      session.value,
    )
    licenses.value = licenses.value.map((license) => (license.id === x.id ? updated : license))
  } catch (e) {
    featureError.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    saving.value = false
  }
}
function requestRemove(x: AdminFeatureLicense) {
  if (saving.value || installedCore(x)) return
  featureError.value = ''
  removeTarget.value = x
}
function cancelRemoval() {
  if (saving.value) return
  removeTarget.value = null
  featureError.value = ''
}
async function removeFeature() {
  if (!session.value || !selected.value?.userId || !removeTarget.value || saving.value) return
  saving.value = true
  featureError.value = ''
  const licenseId = removeTarget.value.id
  try {
    await removeAdminUserFeature(selected.value.userId, licenseId, session.value)
    licenses.value = licenses.value.filter((license) => license.id !== licenseId)
    removeTarget.value = null
    toast.value = t('admin.page.userFeatureRemoved')
  } catch (e) {
    featureError.value = e instanceof Error ? e.message : t('admin.page.removeUserFeatureError')
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>
<template>
  <AdminLayout
    ><div class="space-y-3xl">
      <AdminPageHeader
        :title="t('admin.page.usersTitle')"
        :description="t('admin.page.usersDescription')"
        :icon="Users"
        ><template #actions
          ><form class="flex w-full items-center gap-xs tablet:w-auto" @submit.prevent="load">
            <div class="min-w-0 flex-1 tablet:w-80">
              <AppTextField v-model="query" label="" :placeholder="t('admin.page.usersSearch')" />
            </div>
            <AppButton type="submit" class="!w-auto" :aria-label="t('admin.common.search')"
              ><Search class="size-4"
            /></AppButton>
          </form>
          <AppButton class="!w-auto" variant="secondary" :disabled="loading" @click="load"
            ><RefreshCw class="size-4" />{{ t('admin.common.refresh') }}</AppButton
          ></template
        ></AdminPageHeader
      >
      <div
        v-if="error"
        class="rounded-xl border border-error-border bg-error-bg p-md text-error-text"
      >
        {{ error }}
      </div>
      <section id="admin-users-list">
        <AdminPanel>
          <div class="admin-table-scroll overflow-x-auto" :aria-busy="userPages.loading.value">
            <table class="w-full min-w-[880px] text-left text-sm">
              <thead class="text-xs text-text-muted">
                <tr>
                  <th class="pb-sm">{{ t('admin.page.user') }}</th>
                  <th class="pb-sm">{{ t('admin.page.roleStatus') }}</th>
                  <th class="pb-sm text-right">{{ t('admin.page.balance') }}</th>
                  <th class="pb-sm text-right">{{ t('admin.page.manage') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle">
                <tr v-for="x in users" :key="x.userId ?? x.customerId">
                  <td class="py-md">
                    <b class="text-text-primary">{{ x.displayName || 'User' }}</b>
                    <p class="text-xs text-text-muted">{{ x.email || x.userId }}</p>
                    <p class="text-xs font-mono text-text-muted">{{ x.customerCode }}</p>
                  </td>
                  <td>
                    <div class="flex gap-xs">
                      <AdminStatusBadge :value="x.role" /><AdminStatusBadge :value="x.status" />
                    </div>
                  </td>
                  <td class="text-right font-mono font-bold text-text-primary">
                    ฿{{
                      (x.balanceSatang / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })
                    }}
                  </td>
                  <td>
                    <div class="flex justify-end gap-xs">
                      <button
                        class="rounded-md p-xs text-text-secondary hover:bg-bg-surface-hover"
                        :aria-label="t('admin.page.accountSettings')"
                        @click="openAccount(x)"
                      >
                        <Settings class="size-4" /></button
                      ><button
                        class="rounded-md p-xs text-text-secondary hover:bg-bg-surface-hover"
                        :aria-label="t('admin.page.walletAdjustment')"
                        @click="openWallet(x)"
                      >
                        <WalletCards class="size-4" /></button
                      ><button
                        class="rounded-md p-xs text-text-secondary hover:bg-bg-surface-hover"
                        :aria-label="t('admin.page.userFeatures')"
                        @click="openFeatures(x)"
                      >
                        <Blocks class="size-4" /></button
                      ><button
                        class="rounded-md px-sm py-xs text-xs text-text-secondary hover:bg-bg-surface-hover"
                        @click="openHistory(x)"
                      >
                        {{ t('admin.page.history') }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div ref="usersSentinel" aria-hidden="true"></div></div
        ></AdminPanel>
      </section>
      <AppSectionIndicator :sections="sections" :aria-label="t('admin.sections.navigation')" />
      <AppModal
        :open="mode === 'account'"
        :title="t('admin.page.accountSettings')"
        :subtitle="selected?.email || selected?.userId || ''"
        :disabled="saving"
        @update:open="
          (v) => {
            if (!v) close()
          }
        "
        ><div class="grid gap-md tablet:grid-cols-2">
          <AppTextField
            v-model="account.displayName"
            :label="t('admin.page.displayName')"
          /><AppTextField
            v-model="account.firstName"
            :label="t('admin.page.firstName')"
          /><AppTextField
            v-model="account.lastName"
            :label="t('admin.page.lastName')"
          /><AppTextField
            v-model="account.role"
            variant="dropdown"
            :label="t('admin.page.role')"
            :options="['USER', 'TESTER', 'EDITOR', 'ADMIN'].map((x) => ({ value: x, label: x }))"
          /><AppTextField
            v-model="account.status"
            variant="dropdown"
            :label="t('admin.common.status')"
            :options="
              ['ACTIVE', 'SUSPENDED', 'BANNED', 'DEACTIVATED'].map((x) => ({ value: x, label: x }))
            "
          />
        </div>
        <template #actions
          ><AppButton variant="primary" :disabled="saving" @click="close">{{
            t('admin.common.cancel')
          }}</AppButton
          ><AppButton variant="secondary" :disabled="saving" @click="saveAccount">{{
            t('admin.common.save')
          }}</AppButton></template
        ></AppModal
      >
      <AppModal
        :open="mode === 'wallet'"
        :title="t('admin.page.walletAdjustment')"
        :subtitle="selected?.displayName || selected?.email || ''"
        :disabled="saving"
        @update:open="
          (v) => {
            if (!v) close()
          }
        "
        ><div class="grid gap-md tablet:grid-cols-2">
          <AppTextField
            v-model="wallet.direction"
            variant="dropdown"
            :label="t('admin.page.walletAction')"
            :options="[
              { value: 'CREDIT', label: t('admin.page.credit') },
              { value: 'DEBIT', label: t('admin.page.debit') },
            ]"
          /><AppTextField
            v-model="wallet.entryType"
            variant="dropdown"
            :label="t('admin.page.entryType')"
            :options="
              ['ADJUSTMENT', 'BONUS', 'REFUND', 'TOP_UP', 'PURCHASE'].map((x) => ({
                value: x,
                label: x,
              }))
            "
          /><AppTextField
            v-model="wallet.amount"
            input-type="number"
            unit="฿"
            :label="t('admin.page.amount')"
          /><AppTextField v-model="wallet.description" :label="t('admin.page.note')" />
        </div>
        <template #actions
          ><AppButton variant="primary" :disabled="saving" @click="close">{{
            t('admin.common.cancel')
          }}</AppButton
          ><AppButton
            variant="secondary"
            :disabled="saving || Number(wallet.amount) <= 0"
            @click="saveWallet"
            >{{ t('admin.page.confirm') }}</AppButton
          ></template
        ></AppModal
      >
      <AppModal
        :open="mode === 'features'"
        :title="
          removeTarget ? t('admin.page.removeUserFeatureTitle') : t('admin.page.userFeatures')
        "
        :subtitle="selected?.displayName || selected?.email || selected?.userId || ''"
        size="lg"
        :disabled="saving"
        @update:open="
          (v) => {
            if (!v) close()
          }
        "
      >
        <p v-if="featureError" role="alert" class="mb-md text-sm text-error-text">
          {{ featureError }}
        </p>
        <div v-if="removeTarget" class="space-y-md">
          <p class="font-semibold text-text-primary">
            {{ removeTarget.featureName }} · v{{ removeTarget.version }}
          </p>
          <p class="text-sm text-text-secondary">
            {{
              t('admin.page.removeUserFeatureWarning', {
                user: selected?.displayName || selected?.userId,
              })
            }}
          </p>
          <p class="text-sm text-text-secondary">
            {{ t('admin.page.featureInstalledCount', { count: removeTarget.installationCount }) }}
          </p>
        </div>
        <template v-else>
          <div
            class="grid gap-md rounded-xl border border-border-subtle bg-bg-surface p-md tablet:grid-cols-3"
          >
            <AppTextField
              v-model="grant.featureId"
              variant="dropdown"
              :label="t('admin.page.feature')"
              :options="catalog.map((x) => ({ value: x.id, label: x.name }))"
            /><AppTextField
              v-model="grant.limit"
              input-type="number"
              :label="t('admin.page.limit')"
            /><AppTextField
              v-model="grant.expiresAt"
              input-type="date"
              :label="t('admin.page.expiryOptional')"
            /><AppButton
              class="tablet:col-span-3 !w-auto"
              :disabled="saving || featuresLoading || !grant.featureId || Number(grant.limit) < 1"
              @click="grantFeature"
              >{{ t('admin.page.addFeature') }}</AppButton
            >
          </div>
          <div class="mt-md divide-y divide-border-subtle">
            <div
              v-for="x in visibleLicenses"
              :key="x.id"
              :data-license-id="x.id"
              class="flex flex-col gap-md py-md tablet:flex-row tablet:items-center tablet:justify-between"
            >
              <div class="min-w-0">
                <b class="text-text-primary">{{ x.featureName }}</b>
                <p class="text-xs text-text-muted">
                  v{{ x.version }} · {{ t('admin.page.limit') }} {{ x.installationLimit }}
                </p>
                <p class="mt-xs text-xs text-text-muted">
                  {{ t('admin.page.featureInstalledCount', { count: x.installationCount }) }}
                </p>
                <p v-if="installedCore(x)" class="mt-xs text-xs text-text-secondary">
                  {{ t('admin.page.installedCoreProtected') }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-sm">
                <AdminStatusBadge :value="x.status" /><AppButton
                  class="!w-auto"
                  :disabled="saving || featuresLoading"
                  @click="toggleLicense(x)"
                  >{{
                    x.status === 'ACTIVE' ? t('admin.page.suspend') : t('admin.page.activate')
                  }}</AppButton
                >
                <AppButton
                  variant="secondary"
                  class="!w-auto"
                  :disabled="saving || featuresLoading || installedCore(x)"
                  :aria-label="t('admin.page.removeUserFeatureLabel', { name: x.featureName })"
                  @click="requestRemove(x)"
                >
                  <Trash2 :size="16" aria-hidden="true" />{{ t('admin.page.removeUserFeature') }}
                </AppButton>
              </div>
            </div>
            <p v-if="featuresLoading" class="py-lg text-center text-sm text-text-muted">
              {{ t('admin.common.loading') }}
            </p>
            <p
              v-else-if="!visibleLicenses.length"
              class="py-lg text-center text-sm text-text-muted"
            >
              {{ t('admin.common.noData') }}
            </p>
          </div>
        </template>
        <template #actions>
          <template v-if="removeTarget">
            <AppButton variant="secondary" :disabled="saving" @click="cancelRemoval">{{
              t('admin.common.cancel')
            }}</AppButton>
            <AppButton :loading="saving" :disabled="saving" @click="removeFeature">{{
              t('admin.page.removeUserFeatureConfirm')
            }}</AppButton>
          </template>
          <AppButton v-else variant="primary" :disabled="saving" @click="close">{{
            t('admin.common.close')
          }}</AppButton>
        </template>
      </AppModal>
      <AppModal
        :open="mode === 'history'"
        :title="t('admin.page.walletHistory')"
        size="lg"
        @update:open="
          (v) => {
            if (!v) close()
          }
        "
        ><div class="divide-y divide-border-subtle" :aria-busy="historyPages.loading.value">
          <div v-for="x in history" :key="x.id" class="flex justify-between gap-md py-sm">
            <div>
              <b class="text-text-primary">{{ x.entryType }}</b>
              <p class="text-xs text-text-muted">
                {{ x.description || new Date(x.createdAt).toLocaleString() }}
              </p>
            </div>
            <b :class="x.direction === 'CREDIT' ? 'text-success-text' : 'text-error-text'"
              >{{ x.direction === 'CREDIT' ? '+' : '-' }}฿{{
                (x.amountSatang / 100).toLocaleString()
              }}</b
            >
          </div>
          <p v-if="!history.length" class="py-xl text-center text-text-muted">
            {{ t('admin.common.noData') }}
          </p>
          <p v-if="historyError" role="alert" class="py-sm text-error-text">{{ historyError }}</p>
          <div ref="historySentinel" aria-hidden="true"></div>
        </div>
        <template #actions
          ><AppButton variant="primary" @click="close">{{
            t('admin.common.close')
          }}</AppButton></template
        ></AppModal
      >
      <AppToast
        :open="Boolean(toast)"
        :message="toast"
        variant="success"
        @update:open="
          (v) => {
            if (!v) toast = ''
          }
        "
      /></div
  ></AdminLayout>
</template>
