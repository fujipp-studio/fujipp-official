<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Bot, Clock3, Search } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import {
  controlBot,
  createBot,
  fetchBots,
  fetchFeatureLicenses,
  installFeatureLicense,
  updateBotDiscordToken,
  syncBotDiscordProfile,
  type FeatureLicense,
  type UserBot,
} from '@/features/bots/api'
import {
  fetchRuntimeSubscriptions,
  assignRuntime,
  renewRuntime,
  updateRuntimeAutoRenew,
  type RuntimeSubscription,
} from '@/features/bots/runtime-api'
import { useAuthStore } from '../../../stores'
import { AppButton, AppModal, AppTextField, AppToast, AppToggle } from '../../../shared/ui'
import { icons } from '../../../config'
import {
  botRuntimeDisplayState,
  isBotOnline,
  type BotControlAction,
  type BotRuntimeDisplayState,
} from '../runtime-status'
import {
  groupPackageInventory,
  nextInstallableLicense,
  type PackageInventoryGroup,
} from '../package-inventory'
import { filterRuntimeInventory, runtimeBotSelections } from '../runtime-inventory'

const authStore = useAuthStore()
const router = useRouter()
const { locale, t } = useI18n()
const { session, initialized } = storeToRefs(authStore)
const bots = ref<UserBot[]>([])
const licenses = ref<FeatureLicense[]>([])
const runtimeSubscriptions = ref<RuntimeSubscription[]>([])
const loading = ref(true)
const toastOpen = ref(false)
const toastMessage = ref('')
const toastVariant = ref<'info' | 'success' | 'error'>('info')
const showCreate = ref(false)
const creating = ref(false)
const busyBotId = ref('')
const busyAction = ref<BotControlAction | null>(null)
const installingLicenseId = ref('')
const featureSearch = ref('')
const runtimeSearch = ref('')
const targetBotByPackage = ref<Record<string, string>>({})
const targetBotByRuntime = ref<Record<string, string>>({})
const createForm = ref({ name: '', discordApplicationId: '', discordGuildId: '', token: '' })
const showAutoRenewModal = ref(false)
const selectedAutoRenewRuntime = ref<RuntimeSubscription | null>(null)
const updatingAutoRenew = ref(false)

const showInstallModal = ref(false)
const pendingInstall = ref<{
  license: FeatureLicense
  packageKey: string
  botId: string
  botName: string
} | null>(null)

const showBindModal = ref(false)
const pendingBotBind = ref<{
  runtime: RuntimeSubscription
  newBotId: string
  newBotName: string
  oldBotId: string
} | null>(null)
const updatingBind = ref(false)

let botRefreshTimer: ReturnType<typeof setInterval> | undefined

function openCreateDialog() {
  showCreate.value = true
}

function closeCreateDialog() {
  if (creating.value) return
  showCreate.value = false
  createForm.value = { name: '', discordApplicationId: '', discordGuildId: '', token: '' }
}

function showToast(message: string, variant: 'info' | 'success' | 'error' = 'info') {
  toastMessage.value = message
  toastVariant.value = variant
  toastOpen.value = false
  requestAnimationFrame(() => {
    toastOpen.value = true
  })
}

const packageInventory = computed(() => groupPackageInventory(licenses.value, featureSearch.value))
const botOptions = computed(() =>
  bots.value.map((bot) => ({
    label: bot.name,
    value: bot.id,
  })),
)
const visibleRuntimeSubscriptions = computed(() =>
  filterRuntimeInventory(
    runtimeSubscriptions.value,
    runtimeSearch.value,
    (runtime) =>
      `${runtimeSlotLabel(runtime)} ${runtimePlanLabel(runtime)} ${runtimeStatusLabel(runtime)}`,
  ),
)

function runtimeExpiry(runtime: RuntimeSubscription) {
  const date =
    runtime.status === 'GRACE' && runtime.graceUntil ? runtime.graceUntil : runtime.currentPeriodEnd
  return new Intl.DateTimeFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

const runtimeLabelKeys: Record<BotRuntimeDisplayState, string> = {
  starting: 'myBots.runtimeStateStarting',
  stopping: 'myBots.runtimeStateStopping',
  restarting: 'myBots.runtimeStateRestarting',
  running: 'myBots.runtimeStateRunning',
  stopped: 'myBots.runtimeStateStopped',
  crashed: 'myBots.runtimeStateCrashed',
  offline: 'myBots.runtimeStateOffline',
}

function runtimeLabel(bot: UserBot) {
  const pendingAction = busyBotId.value === bot.id ? busyAction.value : null
  return t(runtimeLabelKeys[botRuntimeDisplayState(bot, pendingAction)])
}

const runtimeStatusLabelKeys: Record<RuntimeSubscription['status'], string> = {
  ACTIVE: 'myBots.runtimeStatusActive',
  GRACE: 'myBots.runtimeStatusGrace',
  EXPIRED: 'myBots.runtimeStatusExpired',
  CANCELLED: 'myBots.runtimeStatusCancelled',
}

function runtimeStatusLabel(runtime: RuntimeSubscription) {
  return t(runtimeStatusLabelKeys[runtime.status])
}

function runtimeSlotLabel(runtime: RuntimeSubscription) {
  return t('myBots.runtimeSlot', { slot: runtime.slotNumber })
}

function runtimePlanLabel(runtime: RuntimeSubscription) {
  if (runtime.durationDays % 30 === 0) {
    const months = runtime.durationDays / 30
    return t(months === 1 ? 'myBots.runtimePlanOneMonth' : 'myBots.runtimePlanMonths', {
      count: months,
    })
  }

  return t(runtime.durationDays === 1 ? 'myBots.runtimePlanOneDay' : 'myBots.runtimePlanDays', {
    count: runtime.durationDays,
  })
}

function runtimeDescription(runtime: RuntimeSubscription) {
  return `${runtimeSlotLabel(runtime)} · ${runtimePlanLabel(runtime)}`
}

function runtimeRenewalPrice(runtime: RuntimeSubscription) {
  return new Intl.NumberFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(runtime.effectiveRenewalPriceSatang / 100)
}

async function loadDashboard() {
  loading.value = true
  if (!session.value) {
    loading.value = false
    return
  }
  try {
    ;[bots.value, licenses.value, runtimeSubscriptions.value] = await Promise.all([
      fetchBots(session.value),
      fetchFeatureLicenses(session.value),
      fetchRuntimeSubscriptions(session.value),
    ])

    targetBotByRuntime.value = runtimeBotSelections(runtimeSubscriptions.value)
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : t('myBots.loadFailed'), 'error')
  } finally {
    loading.value = false
  }
}

async function refreshBots() {
  if (!session.value) return
  try {
    bots.value = await fetchBots(session.value)
  } catch {
    // Keep the current cards visible when a background refresh temporarily fails.
  }
}

async function syncMissingBotProfiles() {
  if (!session.value) return
  const missing = bots.value.filter((bot) => !bot.discordAvatarUrl)
  if (!missing.length) return
  const synced = await Promise.allSettled(
    missing.map((bot) => syncBotDiscordProfile(bot.id, session.value!)),
  )
  const updates = new Map(
    synced
      .filter((result): result is PromiseFulfilledResult<UserBot> => result.status === 'fulfilled')
      .map((result) => [result.value.id, result.value]),
  )
  bots.value = bots.value.map((bot) => updates.get(bot.id) ?? bot)
}

async function submitBot() {
  if (!session.value || !createForm.value.name.trim()) return
  creating.value = true
  try {
    const bot = await createBot(
      {
        name: createForm.value.name.trim(),
        discordApplicationId: createForm.value.discordApplicationId.trim() || null,
        discordGuildId: createForm.value.discordGuildId.trim() || null,
      },
      session.value,
    )
    if (createForm.value.token.trim()) {
      await updateBotDiscordToken(bot.id, createForm.value.token.trim(), session.value)
    }
    showCreate.value = false
    createForm.value = { name: '', discordApplicationId: '', discordGuildId: '', token: '' }
    showToast(t('myBots.createSuccess'), 'success')
    await loadDashboard()
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : t('myBots.createFailed'), 'error')
  } finally {
    creating.value = false
  }
}

function beginEdit(bot: UserBot) {
  void router.push({ name: 'bot-settings', params: { botId: bot.id } })
}

async function runControl(bot: UserBot, action: BotControlAction) {
  if (!session.value) return
  busyBotId.value = bot.id
  busyAction.value = action
  try {
    const updated = await controlBot(bot.id, action, session.value)
    bots.value = bots.value.map((item) => (item.id === updated.id ? updated : item))
    const successKey = {
      start: 'myBots.startCommandSent',
      stop: 'myBots.stopCommandSent',
      restart: 'myBots.restartCommandSent',
    }[action]
    showToast(t(successKey, { bot: bot.name }), 'success')
    await refreshBots()
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : t('myBots.controlFailed'), 'error')
  } finally {
    busyBotId.value = ''
    busyAction.value = null
  }
}

function handlePackageBotSelect(group: PackageInventoryGroup, newBotId: string) {
  if (!newBotId) return
  const license = nextInstallableLicense(group)
  if (!license) return
  targetBotByPackage.value[group.key] = newBotId
  const bot = bots.value.find((b) => b.id === newBotId)
  pendingInstall.value = {
    license,
    packageKey: group.key,
    botId: newBotId,
    botName: bot ? bot.name : t('myBots.unnamedBot'),
  }
  showInstallModal.value = true
}

function closeInstallModal() {
  if (installingLicenseId.value) return
  if (pendingInstall.value) {
    targetBotByPackage.value[pendingInstall.value.packageKey] = ''
  }
  showInstallModal.value = false
  pendingInstall.value = null
}

async function confirmInstallPackage() {
  if (!session.value || !pendingInstall.value) return
  const { license, packageKey, botId, botName } = pendingInstall.value
  installingLicenseId.value = license.id
  try {
    await installFeatureLicense(license.id, botId, session.value)
    showToast(t('myBots.installSuccess', { package: license.featureName, bot: botName }), 'success')
    targetBotByPackage.value[packageKey] = ''
    await loadDashboard()
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : t('myBots.installFailed'), 'error')
    targetBotByPackage.value[packageKey] = ''
  } finally {
    installingLicenseId.value = ''
    showInstallModal.value = false
    pendingInstall.value = null
  }
}

function handleBotSelectChange(runtime: RuntimeSubscription, newBotId: string) {
  const oldBotId = targetBotByRuntime.value[runtime.id] ?? runtime.botId ?? ''
  if (newBotId === oldBotId) return

  const selectedBot = bots.value.find((b) => b.id === newBotId)
  pendingBotBind.value = {
    runtime,
    newBotId,
    newBotName: selectedBot ? selectedBot.name : t('myBots.unnamedBot'),
    oldBotId,
  }
  showBindModal.value = true
}

function closeBindModal() {
  if (updatingBind.value) return
  if (pendingBotBind.value) {
    targetBotByRuntime.value[pendingBotBind.value.runtime.id] = pendingBotBind.value.oldBotId
  }
  showBindModal.value = false
  pendingBotBind.value = null
}

async function confirmBindBot() {
  if (!session.value || !pendingBotBind.value) return
  updatingBind.value = true
  const { runtime, newBotId, newBotName, oldBotId } = pendingBotBind.value
  try {
    await assignRuntime(runtime.id, newBotId, session.value)
    targetBotByRuntime.value[runtime.id] = newBotId
    await loadDashboard()
    showToast(
      t('myBots.bindSuccess', { runtime: runtimeDescription(runtime), bot: newBotName }),
      'success',
    )
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : t('myBots.bindFailed'), 'error')
    targetBotByRuntime.value[runtime.id] = oldBotId
  } finally {
    updatingBind.value = false
    showBindModal.value = false
    pendingBotBind.value = null
  }
}

function openAutoRenewModal(runtime: RuntimeSubscription) {
  selectedAutoRenewRuntime.value = runtime
  showAutoRenewModal.value = true
}

function closeAutoRenewModal() {
  if (updatingAutoRenew.value) return
  showAutoRenewModal.value = false
  selectedAutoRenewRuntime.value = null
}

async function confirmToggleAutoRenew() {
  if (!session.value || !selectedAutoRenewRuntime.value) return
  updatingAutoRenew.value = true
  const runtime = selectedAutoRenewRuntime.value
  const targetState = !runtime.autoRenew
  try {
    await updateRuntimeAutoRenew(runtime.id, targetState, session.value)
    await loadDashboard()
    showToast(
      t('myBots.autoRenewUpdated', {
        runtime: runtimeSlotLabel(runtime),
        state: t(targetState ? 'myBots.enabled' : 'myBots.disabled'),
      }),
      'success',
    )
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : t('myBots.updateFailed'), 'error')
  } finally {
    updatingAutoRenew.value = false
    showAutoRenewModal.value = false
    selectedAutoRenewRuntime.value = null
  }
}

async function renew(runtime: RuntimeSubscription) {
  if (!session.value) return
  try {
    await renewRuntime(runtime.id, session.value)
    await loadDashboard()
    showToast(t('myBots.renewSuccess', { runtime: runtimeSlotLabel(runtime) }), 'success')
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : t('myBots.renewFailed'), 'error')
  }
}

onMounted(async () => {
  if (!initialized.value) await authStore.initialize()
  await loadDashboard()
  await syncMissingBotProfiles()
  botRefreshTimer = setInterval(() => void refreshBots(), 3000)
})

onBeforeUnmount(() => {
  if (botRefreshTimer) clearInterval(botRefreshTimer)
})
</script>

<template>
  <main class="min-h-screen bg-bg-default pt-24 text-text-primary desktop:pt-28">
    <div class="page-container space-y-3xl pb-5xl">
      <section aria-labelledby="my-bot-title" class="space-y-xl">
        <div
          class="flex flex-col gap-md tablet:flex-row tablet:items-center tablet:justify-between"
        >
          <h1 id="my-bot-title" class="text-4xl font-extrabold tracking-tight desktop:text-5xl">
            {{ t('myBots.title') }}
          </h1>
          <AppButton
            v-if="session"
            class="tablet:!w-auto"
            :left-icon="icons.base.add"
            @click="openCreateDialog"
          >
            {{ t('myBots.addBot') }}
          </AppButton>
        </div>

        <div class="grid gap-md tablet:grid-cols-2 desktop:grid-cols-3">
          <article
            v-for="bot in bots"
            :key="bot.id"
            class="flex min-w-0 flex-col gap-md rounded-xl border border-border-default bg-bg-surface p-md shadow-sm"
          >
            <div class="flex min-w-0 gap-md">
              <div
                class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-bg-elevated"
              >
                <img
                  v-if="bot.discordAvatarUrl"
                  :src="bot.discordAvatarUrl"
                  :alt="t('myBots.avatarAlt', { name: bot.name })"
                  loading="lazy"
                  decoding="async"
                  class="size-full object-cover"
                />
                <span v-else class="text-3xl font-extrabold">{{
                  bot.name.slice(0, 1).toUpperCase()
                }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <h2 class="truncate text-xl font-extrabold">{{ bot.name }}</h2>
                <span
                  class="mt-xs inline-flex items-center gap-xs rounded-full border border-border-default px-sm py-xxs text-xs font-semibold"
                >
                  <span
                    class="size-2 rounded-full"
                    :class="isBotOnline(bot) ? 'bg-success-text' : 'bg-text-muted'"
                  />
                  {{ t(isBotOnline(bot) ? 'myBots.online' : 'myBots.offline') }}
                </span>
                <p class="mt-sm flex items-center gap-xs text-sm text-text-muted">
                  <Clock3 :size="15" />{{ runtimeLabel(bot) }}
                </p>
              </div>
            </div>
            <div class="h-px bg-border-subtle" />
            <div class="grid grid-cols-3 gap-xs">
              <AppButton
                variant="secondary"
                :left-icon="bot.desiredState === 'RUNNING' ? icons.action.pause : icons.action.play"
                :disabled="busyBotId === bot.id"
                @click="runControl(bot, bot.desiredState === 'RUNNING' ? 'stop' : 'start')"
              >
                {{ t(bot.desiredState === 'RUNNING' ? 'myBots.stop' : 'myBots.start') }}
              </AppButton>
              <AppButton
                variant="secondary"
                :left-icon="icons.action.restart"
                :disabled="busyBotId === bot.id || bot.desiredState !== 'RUNNING'"
                @click="runControl(bot, 'restart')"
                >{{ t('myBots.restart') }}</AppButton
              >
              <AppButton
                variant="secondary"
                :left-icon="icons.action.setting"
                :disabled="busyBotId === bot.id"
                @click="beginEdit(bot)"
                >{{ t('myBots.settings') }}</AppButton
              >
            </div>
          </article>
          <article
            v-for="index in loading ? 3 : 0"
            :key="`skeleton-${index}`"
            class="h-52 animate-pulse rounded-xl border border-border-subtle bg-bg-surface"
          />
        </div>
        <div
          v-if="!loading && !bots.length"
          class="rounded-xl border border-dashed border-border-default p-2xl text-center text-text-muted"
        >
          <Bot :size="36" class="mx-auto mb-sm" />{{ t('myBots.noBots') }}
        </div>
      </section>

      <section aria-labelledby="purchases-title" class="space-y-xl">
        <div
          class="flex flex-col gap-md tablet:flex-row tablet:items-center tablet:justify-between"
        >
          <h2 id="purchases-title" class="text-3xl font-extrabold">
            {{ t('myBots.purchases') }}
          </h2>
          <AppButton
            class="tablet:!w-auto"
            :left-icon="icons.navigation.store"
            @click="router.push({ name: 'store' })"
            >{{ t('myBots.store') }}</AppButton
          >
        </div>

        <div class="space-y-sm">
          <div
            class="flex flex-col gap-sm tablet:flex-row tablet:items-center tablet:justify-between"
          >
            <h3 class="text-xl font-semibold">{{ t('myBots.packages') }}</h3>
            <label class="relative block"
              ><Search
                :size="17"
                class="absolute left-sm top-1/2 -translate-y-1/2 text-text-muted" /><input
                v-model="featureSearch"
                class="field !mt-0 !pl-xl"
                :placeholder="t('myBots.searchPackages')"
                :aria-label="t('myBots.searchPackages')"
            /></label>
          </div>
          <div class="overflow-x-auto rounded-xl border border-border-default bg-bg-surface">
            <table class="w-full min-w-[980px] table-fixed border-collapse text-left">
              <colgroup>
                <col class="w-16" />
                <col class="w-[26%]" />
                <col class="w-[24%]" />
                <col class="w-24" />
                <col />
              </colgroup>
              <thead class="text-sm text-text-muted">
                <tr>
                  <th class="table-cell">{{ t('myBots.order') }}</th>
                  <th class="table-cell">{{ t('myBots.name') }}</th>
                  <th class="table-cell">{{ t('myBots.details') }}</th>
                  <th class="table-cell">{{ t('myBots.inventory') }}</th>
                  <th class="table-cell text-center">{{ t('myBots.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(group, index) in packageInventory"
                  :key="group.key"
                  class="border-t border-border-subtle"
                >
                  <td class="table-cell">{{ index + 1 }}</td>
                  <td class="table-cell font-semibold">{{ group.featureName }}</td>
                  <td class="table-cell text-text-secondary">
                    {{ t('myBots.versionAvailable', { version: group.version }) }}
                  </td>
                  <td class="table-cell whitespace-nowrap text-center tabular-nums">
                    {{ group.availableSlots }}/{{ group.installationLimit }}
                  </td>
                  <td class="table-cell">
                    <div class="flex flex-wrap items-center justify-end gap-sm">
                      <AppTextField
                        :model-value="targetBotByPackage[group.key] || ''"
                        variant="dropdown"
                        label=""
                        :options="botOptions"
                        :placeholder="t('myBots.selectBot')"
                        class="w-56 min-w-0"
                        :disabled="Boolean(installingLicenseId)"
                        @update:model-value="(val) => handlePackageBotSelect(group, String(val))"
                      />
                    </div>
                  </td>
                </tr>
                <tr v-if="!loading && !packageInventory.length">
                  <td colspan="5" class="h-40 text-center text-text-muted">
                    {{ t('myBots.noPackages') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="space-y-sm">
          <div
            class="flex flex-col gap-sm tablet:flex-row tablet:items-center tablet:justify-between"
          >
            <h3 class="text-xl font-semibold">{{ t('myBots.runtime') }}</h3>
            <label class="relative block"
              ><Search
                :size="17"
                class="absolute left-sm top-1/2 -translate-y-1/2 text-text-muted" /><input
                v-model="runtimeSearch"
                class="field !mt-0 !pl-xl"
                :placeholder="t('myBots.searchRuntime')"
                :aria-label="t('myBots.searchRuntime')"
            /></label>
          </div>
          <div class="overflow-x-auto rounded-xl border border-border-default bg-bg-surface">
            <table class="w-full min-w-[860px] border-collapse text-left">
              <thead class="text-sm text-text-muted">
                <tr>
                  <th class="table-cell w-16">{{ t('myBots.order') }}</th>
                  <th class="table-cell">{{ t('myBots.name') }}</th>
                  <th class="table-cell">{{ t('myBots.status') }}</th>
                  <th class="table-cell">{{ t('myBots.inUseBy') }}</th>
                  <th class="table-cell text-center">{{ t('myBots.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(runtime, index) in visibleRuntimeSubscriptions"
                  :key="runtime.id"
                  class="border-t border-border-subtle"
                >
                  <td class="table-cell">{{ index + 1 }}</td>
                  <td class="table-cell font-semibold">
                    {{ runtimeDescription(runtime) }}
                    <p class="text-xs font-normal text-text-muted">
                      {{
                        t('myBots.renewalPrice', {
                          price: runtimeRenewalPrice(runtime),
                        })
                      }}
                    </p>
                  </td>
                  <td class="table-cell">
                    <span>{{ runtimeStatusLabel(runtime) }}</span>
                    <p class="text-xs text-text-muted">
                      {{ t(runtime.status === 'GRACE' ? 'myBots.graceUntil' : 'myBots.expiresAt') }}
                      {{ runtimeExpiry(runtime) }}
                    </p>
                  </td>
                  <td class="table-cell">
                    <AppTextField
                      :model-value="targetBotByRuntime[runtime.id]"
                      variant="dropdown"
                      label=""
                      :options="botOptions"
                      :placeholder="t('myBots.selectBot')"
                      class="min-w-[140px]"
                      @update:model-value="(val) => handleBotSelectChange(runtime, val)"
                    />
                  </td>
                  <td class="table-cell">
                    <div class="flex flex-wrap items-center justify-center gap-md">
                      <AppToggle
                        :model-value="runtime.autoRenew"
                        :disabled="updatingAutoRenew"
                        :label="t('myBots.automaticRenewal')"
                        @change="openAutoRenewModal(runtime)"
                      />
                      <AppButton
                        v-if="runtime.status === 'GRACE'"
                        variant="secondary"
                        @click="renew(runtime)"
                        >{{ t('myBots.renewNow') }}</AppButton
                      >
                    </div>
                  </td>
                </tr>
                <tr v-if="!loading && !visibleRuntimeSubscriptions.length">
                  <td colspan="5" class="h-40 text-center text-text-muted">
                    {{ t('myBots.noRuntime') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
    <AppModal
      v-model:open="showCreate"
      :subtitle="t('myBots.title')"
      :title="t('myBots.addBot')"
      size="lg"
      :disabled="creating"
      @close="closeCreateDialog"
    >
      <form id="create-bot-form" class="grid gap-md tablet:grid-cols-2" @submit.prevent="submitBot">
        <AppTextField
          v-model="createForm.name"
          :label="t('myBots.botName')"
          :placeholder="t('myBots.botNamePlaceholder')"
          required
          :maxlength="100"
          :disabled="creating"
        />
        <AppTextField
          v-model="createForm.token"
          variant="secret"
          :label="t('myBots.botToken')"
          :placeholder="t('myBots.botToken')"
          autocomplete="new-password"
          :disabled="creating"
        />
        <AppTextField
          v-model="createForm.discordApplicationId"
          :label="t('myBots.discordApplicationId')"
          :placeholder="t('myBots.applicationIdPlaceholder')"
          pattern="[0-9]{15,30}"
          :disabled="creating"
        />
        <AppTextField
          v-model="createForm.discordGuildId"
          :label="t('myBots.discordGuildId')"
          :placeholder="t('myBots.guildIdPlaceholder')"
          pattern="[0-9]{15,30}"
          :disabled="creating"
        />
      </form>
      <template #actions>
        <AppButton
          type="button"
          variant="secondary"
          :disabled="creating"
          @click="closeCreateDialog"
          >{{ t('myBots.cancel') }}</AppButton
        >
        <AppButton
          type="submit"
          form="create-bot-form"
          :disabled="creating || !createForm.name.trim()"
        >
          {{ t(creating ? 'myBots.creating' : 'myBots.create') }}
        </AppButton>
      </template>
    </AppModal>

    <AppModal
      v-model:open="showAutoRenewModal"
      :subtitle="t('myBots.autoRenewModalSubtitle')"
      :title="
        selectedAutoRenewRuntime?.autoRenew
          ? t('myBots.confirmDisableAutoRenew')
          : t('myBots.confirmEnableAutoRenew')
      "
      :disabled="updatingAutoRenew"
      @close="closeAutoRenewModal"
    >
      <i18n-t
        v-if="selectedAutoRenewRuntime"
        keypath="myBots.autoRenewPrompt"
        tag="p"
        class="leading-relaxed"
      >
        <template #action>
          <span class="font-bold text-text-primary">{{
            t(selectedAutoRenewRuntime.autoRenew ? 'myBots.disable' : 'myBots.enable')
          }}</span>
        </template>
        <template #runtime>
          <span class="font-semibold text-text-primary">{{
            runtimeDescription(selectedAutoRenewRuntime)
          }}</span>
        </template>
      </i18n-t>
      <template #actions>
        <AppButton
          type="button"
          variant="secondary"
          :disabled="updatingAutoRenew"
          @click="closeAutoRenewModal"
        >
          {{ t('myBots.cancel') }}
        </AppButton>
        <AppButton type="button" :disabled="updatingAutoRenew" @click="confirmToggleAutoRenew">
          {{
            updatingAutoRenew
              ? t('myBots.updating')
              : selectedAutoRenewRuntime?.autoRenew
                ? t('myBots.confirmDisable')
                : t('myBots.confirmEnable')
          }}
        </AppButton>
      </template>
    </AppModal>

    <AppModal
      v-model:open="showBindModal"
      :subtitle="t('myBots.runtimeAssignment')"
      :title="t('myBots.confirmBotChange')"
      :disabled="updatingBind"
      @close="closeBindModal"
    >
      <i18n-t
        v-if="pendingBotBind"
        keypath="myBots.bindRuntimePrompt"
        tag="p"
        class="leading-relaxed"
      >
        <template #runtime>
          <span class="font-semibold text-text-primary">{{
            runtimeDescription(pendingBotBind.runtime)
          }}</span>
        </template>
        <template #bot>
          <span class="font-bold text-text-primary">{{ pendingBotBind.newBotName }}</span>
        </template>
      </i18n-t>
      <template #actions>
        <AppButton
          type="button"
          variant="secondary"
          :disabled="updatingBind"
          @click="closeBindModal"
        >
          {{ t('myBots.cancel') }}
        </AppButton>
        <AppButton type="button" :disabled="updatingBind" @click="confirmBindBot">
          {{ t(updatingBind ? 'myBots.updating' : 'myBots.confirmBotChangeAction') }}
        </AppButton>
      </template>
    </AppModal>

    <AppModal
      v-model:open="showInstallModal"
      :subtitle="t('myBots.packageInstallation')"
      :title="t('myBots.confirmPackageUse')"
      :disabled="Boolean(installingLicenseId)"
      @close="closeInstallModal"
    >
      <i18n-t
        v-if="pendingInstall"
        keypath="myBots.installPackagePrompt"
        tag="p"
        class="leading-relaxed"
      >
        <template #package>
          <span class="font-bold text-text-primary">{{ pendingInstall.license.featureName }}</span>
        </template>
        <template #bot>
          <span class="font-bold text-text-primary">{{ pendingInstall.botName }}</span>
        </template>
      </i18n-t>
      <template #actions>
        <AppButton
          type="button"
          variant="secondary"
          :disabled="Boolean(installingLicenseId)"
          @click="closeInstallModal"
        >
          {{ t('myBots.cancel') }}
        </AppButton>
        <AppButton
          type="button"
          :disabled="Boolean(installingLicenseId)"
          @click="confirmInstallPackage"
        >
          {{ t(installingLicenseId ? 'myBots.installing' : 'myBots.confirmPackageUseAction') }}
        </AppButton>
      </template>
    </AppModal>
    <AppToast v-model:open="toastOpen" :message="toastMessage" :variant="toastVariant" />
  </main>
</template>

<style scoped>
.field {
  width: 100%;
  height: 2.75rem;
  margin-top: var(--spacing-xs);
  padding-inline: var(--spacing-sm);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  outline: none;
  background: var(--color-bg-default);
  color: var(--color-text-primary);
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}
.field:focus,
.select-field:focus {
  border-color: var(--color-border-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-border-accent) 20%, transparent);
}
.select-field {
  width: 10rem;
  height: 2.5rem;
  padding-inline: var(--spacing-sm);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  outline: none;
  background: var(--color-bg-default);
  color: var(--color-text-primary);
  font-size: 0.875rem;
}
.table-cell {
  padding: var(--spacing-sm) var(--spacing-md);
  vertical-align: middle;
}
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
  }
}
@media (max-width: 39.99rem) {
  .create-bot-form {
    padding: var(--spacing-lg);
  }
  .create-bot-actions {
    display: flex;
    flex-direction: column-reverse;
  }
  .create-bot-cancel {
    width: 100%;
  }
}
</style>
