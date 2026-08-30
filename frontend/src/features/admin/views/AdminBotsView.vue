<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertTriangle,
  Bot,
  Play,
  RefreshCw,
  Settings,
  Square,
  UserRoundCog,
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import {
  AppButton,
  AppModal,
  AppSectionIndicator,
  AppTextField,
  AppToast,
  AppToggle,
} from '../../../shared/ui'
import { useAuthStore } from '../../../stores'
import {
  fetchAdminBots,
  controlAdminBot,
  transferAdminBot,
  type AdminBot,
} from '@/features/admin/api/bots'
import { fetchAdminUsers, type AdminUserSummary } from '@/features/admin/api/users'
import { AdminLayout, AdminPageHeader, AdminPanel, AdminStatusBadge } from '../components'

const auth = useAuthStore()
const { session } = storeToRefs(auth)
const { t } = useI18n()
const router = useRouter()
const bots = ref<AdminBot[]>([]),
  users = ref<AdminUserSummary[]>([]),
  loading = ref(false),
  query = ref('')
const selected = ref<AdminBot | null>(null),
  ownerId = ref(''),
  ownerIdTouched = ref(false),
  keepRunning = ref(false),
  saving = ref(false),
  toast = ref('')
const toastVariant = ref<'success' | 'error'>('success')
const controllingId = ref<string | null>(null)
const filtered = computed(() =>
  bots.value.filter((x) =>
    `${x.name} ${x.id} ${x.ownerDisplayName} ${x.ownerUserId}`
      .toLowerCase()
      .includes(query.value.toLowerCase()),
  ),
)
const sections = computed(() => [{ id: 'admin-bots-list', label: t('admin.sections.list') }])
const ownerSuggestions = computed(() =>
  users.value
    .filter((user) => user.userId && user.userId !== selected.value?.ownerUserId)
    .map((user) => ({
      value: user.userId!,
      label: `${user.displayName || user.email || t('admin.page.user')} · ${user.email || user.userId}`,
    })),
)
async function load() {
  if (!session.value) return
  loading.value = true
  try {
    ;[bots.value, users.value] = await Promise.all([
      fetchAdminBots(session.value),
      fetchAdminUsers(session.value),
    ])
  } catch (e) {
    toastVariant.value = 'error'
    toast.value = e instanceof Error ? e.message : t('admin.page.loadError')
  } finally {
    loading.value = false
  }
}
function openTransfer(bot: AdminBot) {
  selected.value = bot
  ownerId.value = ''
  ownerIdTouched.value = false
  keepRunning.value = false
}
async function transfer() {
  ownerIdTouched.value = true
  if (!session.value || !selected.value || !ownerId.value.trim()) return
  saving.value = true
  try {
    await transferAdminBot(
      selected.value.id,
      ownerId.value.trim(),
      keepRunning.value,
      session.value,
    )
    selected.value = null
    toastVariant.value = 'success'
    toast.value = t('admin.page.transferSuccess')
    await load()
  } catch (e) {
    toastVariant.value = 'error'
    toast.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    saving.value = false
  }
}
async function control(bot: AdminBot, action: 'start' | 'stop') {
  if (!session.value || controllingId.value) return
  controllingId.value = bot.id
  try {
    const updated = await controlAdminBot(bot.id, action, session.value)
    const index = bots.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) bots.value[index] = updated
    toastVariant.value = 'success'
    toast.value = t(action === 'start' ? 'admin.page.startSuccess' : 'admin.page.stopSuccess')
  } catch (e) {
    toastVariant.value = 'error'
    toast.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    controllingId.value = null
  }
}
onMounted(load)
</script>

<template>
  <AdminLayout
    ><div class="space-y-lg">
      <AdminPageHeader
        :title="t('admin.page.botsTitle')"
        :description="t('admin.page.botsDescription')"
        :icon="Bot"
        ><template #actions
          ><div class="w-full tablet:w-80">
            <AppTextField v-model="query" label="" :placeholder="t('admin.page.botsSearch')" />
          </div>
          <AppButton class="!w-auto" variant="secondary" :disabled="loading" @click="load"
            ><RefreshCw class="size-4" :class="{ 'animate-spin': loading }" />{{
              t('admin.common.refresh')
            }}</AppButton
          ></template
        ></AdminPageHeader
      >
      <section id="admin-bots-list">
        <AdminPanel>
          <div v-if="loading" class="py-xl text-center text-text-muted">
            {{ t('admin.common.loading') }}
          </div>
          <div v-else-if="!filtered.length" class="py-xl text-center text-text-muted">
            {{ t('admin.page.noBots') }}
          </div>
          <div v-else class="grid gap-md desktop:grid-cols-2">
            <article
              v-for="item in filtered"
              :key="item.id"
              class="rounded-xl border border-border-subtle bg-bg-elevated p-md"
            >
              <div class="flex items-start justify-between gap-md">
                <div>
                  <h3 class="font-bold text-text-primary">{{ item.name }}</h3>
                  <p class="mt-xxs text-xs text-text-muted">{{ item.id }}</p>
                </div>
                <AdminStatusBadge :value="item.status" />
              </div>
              <dl class="mt-md grid grid-cols-2 gap-sm text-xs">
                <div>
                  <dt class="text-text-muted">{{ t('admin.page.owner') }}</dt>
                  <dd class="mt-xxs font-semibold text-text-primary">
                    {{ item.ownerDisplayName }}
                  </dd>
                </div>
                <div>
                  <dt class="text-text-muted">{{ t('admin.page.desiredState') }}</dt>
                  <dd class="mt-xxs text-text-primary">{{ item.desiredState }}</dd>
                </div>
                <div class="col-span-2">
                  <dt class="text-text-muted">{{ t('admin.page.ownerId') }}</dt>
                  <dd class="mt-xxs break-all font-mono text-text-secondary">
                    {{ item.ownerUserId }}
                  </dd>
                </div>
              </dl>
              <div class="mt-md flex flex-wrap gap-sm border-t border-border-subtle pt-md">
                <AppButton
                  class="!w-auto"
                  variant="secondary"
                  @click="router.push({ name: 'admin-bot-settings', params: { botId: item.id } })"
                  ><Settings class="size-4" />{{ t('admin.page.botSettings') }}</AppButton
                >
                <AppButton
                  v-if="item.desiredState !== 'RUNNING'"
                  class="!w-auto"
                  variant="secondary"
                  :disabled="Boolean(controllingId)"
                  @click="control(item, 'start')"
                  ><Play class="size-4" />{{ t('admin.page.startBot') }}</AppButton
                >
                <AppButton
                  v-else
                  class="!w-auto"
                  variant="secondary"
                  :disabled="Boolean(controllingId)"
                  @click="control(item, 'stop')"
                  ><Square class="size-4" />{{ t('admin.page.stopBot') }}</AppButton
                >
                <AppButton class="!w-auto" variant="primary" @click="openTransfer(item)"
                  ><UserRoundCog class="size-4" />{{ t('admin.page.transfer') }}</AppButton
                >
              </div>
            </article>
          </div>
        </AdminPanel>
      </section>
      <AppSectionIndicator :sections="sections" :aria-label="t('admin.sections.navigation')" />
      <AppModal
        :open="Boolean(selected)"
        :title="t('admin.page.transferTitle')"
        :subtitle="selected ? `${selected.name} · ${selected.id}` : ''"
        :disabled="saving"
        @update:open="
          (v) => {
            if (!v) selected = null
          }
        "
        ><div class="space-y-lg">
          <div
            class="flex items-start gap-sm rounded-xl border border-warning-border bg-warning-bg p-md text-warning-text"
          >
            <AlertTriangle class="mt-xxs size-5 shrink-0" aria-hidden="true" />
            <p class="text-sm leading-relaxed">{{ t('admin.page.transferWarning') }}</p>
          </div>
          <AppTextField
            v-model="ownerId"
            :label="t('admin.page.newOwnerId')"
            placeholder="UUID"
            autocomplete="off"
            variant="dropdown"
            searchable
            :options="ownerSuggestions"
            :search-placeholder="t('admin.page.ownerSearch')"
            :empty-text="t('admin.page.noOwnerSuggestions')"
            required
            :state="ownerIdTouched && !ownerId.trim() ? 'error' : 'default'"
            :support-text="ownerIdTouched && !ownerId.trim() ? t('admin.common.required') : ''"
          />
          <AppToggle
            :model-value="keepRunning"
            :disabled="selected?.desiredState !== 'RUNNING'"
            @change="(value) => (keepRunning = value)"
            >{{ t('admin.page.transferKeepRunning') }}</AppToggle
          >
          <p class="text-xs leading-relaxed text-text-muted">
            {{
              selected?.desiredState === 'RUNNING'
                ? t('admin.page.transferKeepRunningHelp')
                : t('admin.page.transferAlreadyStoppedHelp')
            }}
          </p>
        </div>
        <template #actions
          ><AppButton variant="primary" :disabled="saving" @click="selected = null">{{
            t('admin.common.cancel')
          }}</AppButton
          ><AppButton variant="secondary" :disabled="saving || !ownerId.trim()" @click="transfer">{{
            t('admin.page.transferConfirm')
          }}</AppButton></template
        ></AppModal
      >
      <AppToast
        :open="Boolean(toast)"
        :variant="toastVariant"
        :message="toast"
        @update:open="
          (v) => {
            if (!v) toast = ''
          }
        "
      /></div
  ></AdminLayout>
</template>
