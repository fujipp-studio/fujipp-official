<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Users, RefreshCw, Search, WalletCards, Settings, Blocks } from 'lucide-vue-next'
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
  fetchAdminFeatures,
  fetchAdminUserFeatures,
  fetchAdminUsers,
  fetchUserWalletHistory,
  grantAdminUserFeature,
  updateAdminUser,
  updateAdminUserFeature,
  type AdminAccountRole,
  type AdminAccountStatus,
  type AdminFeature,
  type AdminFeatureLicense,
  type AdminUserSummary,
  type AdminWalletHistoryEntry,
} from '../../../services/backend'
import { AdminLayout, AdminPageHeader, AdminPanel, AdminStatusBadge } from '../components'
const auth = useAuthStore()
const { session } = storeToRefs(auth)
const users = ref<AdminUserSummary[]>([]),
  catalog = ref<AdminFeature[]>([]),
  loading = ref(false),
  saving = ref(false),
  error = ref(''),
  query = ref(''),
  toast = ref('')
const { t } = useI18n()
const sections = computed(() => [{ id: 'admin-users-list', label: t('admin.sections.list') }])
const selected = ref<AdminUserSummary | null>(null),
  mode = ref<'account' | 'wallet' | 'features' | 'history' | null>(null),
  licenses = ref<AdminFeatureLicense[]>([]),
  history = ref<AdminWalletHistoryEntry[]>([])
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
  error.value = ''
  try {
    ;[users.value, catalog.value] = await Promise.all([
      fetchAdminUsers(session.value, query.value.trim()),
      fetchAdminFeatures(session.value),
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
  if (!session.value) return
  selected.value = x
  mode.value = 'features'
  licenses.value = await fetchAdminUserFeatures(x.userId!, session.value)
  grant.value = { featureId: catalog.value[0]?.id ?? '', limit: '1', expiresAt: '' }
}
async function openHistory(x: AdminUserSummary) {
  if (!session.value) return
  selected.value = x
  mode.value = 'history'
  history.value = (await fetchUserWalletHistory(x.customerId || x.userId!, session.value)).entries
}
function close() {
  if (saving.value) return
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
    close()
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
    close()
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    saving.value = false
  }
}
async function grantFeature() {
  if (!session.value || !selected.value?.userId) return
  saving.value = true
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
    error.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    saving.value = false
  }
}
async function toggleLicense(x: AdminFeatureLicense) {
  if (!session.value || !selected.value?.userId) return
  const next = x.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
  await updateAdminUserFeature(
    selected.value.userId,
    x.id,
    { status: next, installationLimit: x.installationLimit, expiresAt: x.expiresAt },
    session.value,
  )
  licenses.value = await fetchAdminUserFeatures(selected.value.userId, session.value)
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
          ><form class="flex w-full gap-xs tablet:w-auto" @submit.prevent="load">
            <div class="w-full tablet:w-80">
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
          <div class="admin-table-scroll overflow-x-auto">
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
          </div></AdminPanel
        >
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
        :title="t('admin.page.userFeatures')"
        size="lg"
        :disabled="saving"
        @update:open="
          (v) => {
            if (!v) close()
          }
        "
        ><div
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
          /><AppButton class="tablet:col-span-3 !w-auto" :disabled="saving" @click="grantFeature">{{
            t('admin.page.addFeature')
          }}</AppButton>
        </div>
        <div class="mt-md divide-y divide-border-subtle">
          <div
            v-for="x in licenses"
            :key="x.id"
            class="flex items-center justify-between gap-md py-md"
          >
            <div>
              <b class="text-text-primary">{{ x.featureName }}</b>
              <p class="text-xs text-text-muted">
                v{{ x.version }} · {{ t('admin.page.limit') }} {{ x.installationLimit }}
              </p>
            </div>
            <div class="flex items-center gap-sm">
              <AdminStatusBadge :value="x.status" /><AppButton
                class="!w-auto"
                @click="toggleLicense(x)"
                >{{
                  x.status === 'ACTIVE' ? t('admin.page.suspend') : t('admin.page.activate')
                }}</AppButton
              >
            </div>
          </div>
        </div>
        <template #actions
          ><AppButton variant="primary" :disabled="saving" @click="close">{{
            t('admin.common.close')
          }}</AppButton></template
        ></AppModal
      >
      <AppModal
        :open="mode === 'history'"
        :title="t('admin.page.walletHistory')"
        size="lg"
        @update:open="
          (v) => {
            if (!v) close()
          }
        "
        ><div class="divide-y divide-border-subtle">
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
