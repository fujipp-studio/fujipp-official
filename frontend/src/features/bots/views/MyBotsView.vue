<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Bot, Clock3, Search } from 'lucide-vue-next'

import {
  controlBot,
  createBot,
  fetchBots,
  fetchFeatureLicenses,
  fetchRuntimeSubscriptions,
  installFeatureLicense,
  assignRuntime,
  renewRuntime,
  updateRuntimeAutoRenew,
  updateBotDiscordToken,
  syncBotDiscordProfile,
  type FeatureLicense,
  type RuntimeSubscription,
  type UserBot,
} from '../../../services/backend'
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

const authStore = useAuthStore()
const router = useRouter()
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

const packageInventory = computed(() =>
  groupPackageInventory(licenses.value, featureSearch.value),
)
const botOptions = computed(() =>
  bots.value.map((bot) => ({
    label: bot.name,
    value: bot.id,
  })),
)
const visibleRuntimeSubscriptions = computed(() =>
  runtimeSubscriptions.value.filter((runtime) =>
    `${runtime.planName} SLOT-${runtime.slotNumber} ${runtime.botName ?? ''}`
      .toLowerCase()
      .includes(runtimeSearch.value.trim().toLowerCase()),
  ),
)

function runtimeExpiry(runtime: RuntimeSubscription) {
  const date =
    runtime.status === 'GRACE' && runtime.graceUntil ? runtime.graceUntil : runtime.currentPeriodEnd
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(date),
  )
}

const runtimeLabels: Record<BotRuntimeDisplayState, string> = {
  starting: 'กำลังเริ่มทำงาน…',
  stopping: 'กำลังหยุดทำงาน…',
  restarting: 'กำลังเริ่มใหม่…',
  running: 'กำลังทำงาน',
  stopped: 'หยุดทำงาน',
  crashed: 'การทำงานขัดข้อง',
  offline: 'ออฟไลน์',
}

function runtimeLabel(bot: UserBot) {
  const pendingAction = busyBotId.value === bot.id ? busyAction.value : null
  return runtimeLabels[botRuntimeDisplayState(bot, pendingAction)]
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

    for (const runtime of runtimeSubscriptions.value) {
      targetBotByRuntime.value[runtime.id] =
        runtime.botId ?? targetBotByRuntime.value[runtime.id] ?? bots.value[0]?.id ?? ''
    }
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'โหลด My Bot ไม่สำเร็จ', 'error')
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
    showToast('สร้างบอทสำเร็จ', 'success')
    await loadDashboard()
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'สร้างบอทไม่สำเร็จ', 'error')
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
    showToast(
      `${bot.name}: ${action === 'start' ? 'ส่งคำสั่งเริ่มทำงานแล้ว' : action === 'stop' ? 'ส่งคำสั่งหยุดทำงานแล้ว' : 'ส่งคำสั่งเริ่มใหม่แล้ว'}`,
      'success',
    )
    await refreshBots()
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'ควบคุมบอทไม่สำเร็จ', 'error')
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
    botName: bot ? bot.name : 'ไม่ระบุ',
  }
  showInstallModal.value = true
}

function installedPackageLicenses(group: PackageInventoryGroup) {
  return group.licenses.filter((license) => license.installations.length > 0)
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
    showToast(`ติดตั้ง ${license.featureName} ให้กับ ${botName} สำเร็จ`, 'success')
    targetBotByPackage.value[packageKey] = ''
    await loadDashboard()
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'ติดตั้งรายการไม่สำเร็จ', 'error')
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
    newBotName: selectedBot ? selectedBot.name : 'ไม่ระบุ',
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
    showToast(`ผูก Runtime SLOT-${runtime.slotNumber} กับ ${newBotName} สำเร็จ`, 'success')
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'ผูก Runtime ไม่สำเร็จ', 'error')
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
      `เปลี่ยนสถานะ Auto-renew ของ SLOT-${runtime.slotNumber} เป็น ${targetState ? 'เปิด' : 'ปิด'} เรียบร้อย`,
      'success',
    )
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'อัปเดตไม่สำเร็จ', 'error')
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
    showToast(`ต่ออายุ SLOT-${runtime.slotNumber} สำเร็จ`, 'success')
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : 'ต่ออายุไม่สำเร็จ', 'error')
  }
}

function openFeatureSettings(licenseId: string) {
  void router.push({ name: 'feature-settings', params: { licenseId } })
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
            My Bot
          </h1>
          <AppButton
            v-if="session"
            class="tablet:!w-auto"
            :left-icon="icons.base.add"
            @click="openCreateDialog"
          >
            เพิ่มบอท
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
                  :alt="`${bot.name} avatar`"
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
                  {{ isBotOnline(bot) ? 'online' : 'offline' }}
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
                {{ bot.desiredState === 'RUNNING' ? 'Stop' : 'Start' }}
              </AppButton>
              <AppButton
                variant="secondary"
                :left-icon="icons.action.restart"
                :disabled="busyBotId === bot.id || bot.desiredState !== 'RUNNING'"
                @click="runControl(bot, 'restart')"
                >Restart</AppButton
              >
              <AppButton
                variant="secondary"
                :left-icon="icons.action.setting"
                :disabled="busyBotId === bot.id"
                @click="beginEdit(bot)"
                >ตั้งค่า</AppButton
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
          <Bot :size="36" class="mx-auto mb-sm" />ไม่พบบอท
        </div>
      </section>

      <section aria-labelledby="purchases-title" class="space-y-xl">
        <div
          class="flex flex-col gap-md tablet:flex-row tablet:items-center tablet:justify-between"
        >
          <h2 id="purchases-title" class="text-3xl font-extrabold">รายการที่ซื้อ</h2>
          <AppButton
            class="tablet:!w-auto"
            :left-icon="icons.navigation.store"
            @click="router.push({ name: 'store' })"
            >ร้านค้า</AppButton
          >
        </div>

        <div class="space-y-sm">
          <div
            class="flex flex-col gap-sm tablet:flex-row tablet:items-center tablet:justify-between"
          >
            <h3 class="text-xl font-semibold">Packages</h3>
            <label class="relative block"
              ><Search
                :size="17"
                class="absolute left-sm top-1/2 -translate-y-1/2 text-text-muted" /><input
                v-model="featureSearch"
                class="field !mt-0 !pl-xl"
                placeholder="ค้นหา Package"
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
                  <th class="table-cell">ลำดับ</th>
                  <th class="table-cell">ชื่อ</th>
                  <th class="table-cell">รายละเอียด</th>
                  <th class="table-cell">คลัง</th>
                  <th class="table-cell text-center">การทำงาน</th>
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
                    v{{ group.version }} · {{ group.availableSlots > 0 ? 'พร้อมใช้งาน' : 'ติดตั้งแล้ว' }}
                  </td>
                  <td class="table-cell whitespace-nowrap text-center tabular-nums">
                    {{ group.availableSlots }}/{{ group.installationLimit }}
                  </td>
                  <td class="table-cell">
                    <div class="flex flex-wrap items-center justify-end gap-sm">
                      <AppTextField
                        v-if="group.availableSlots > 0"
                        :model-value="targetBotByPackage[group.key] || ''"
                        variant="dropdown"
                        label=""
                        :options="botOptions"
                        placeholder="เลือกบอท"
                        class="w-56 min-w-0"
                        :disabled="Boolean(installingLicenseId)"
                        @update:model-value="(val) => handlePackageBotSelect(group, String(val))"
                      />
                      <AppButton
                        v-for="license in installedPackageLicenses(group)"
                        :key="license.id"
                        class="!w-auto min-w-24"
                        variant="secondary"
                        :left-icon="icons.action.setting"
                        @click="openFeatureSettings(license.id)"
                      >
                        ตั้งค่า<span v-if="installedPackageLicenses(group).length > 1">
                          · {{ license.installations.map((item) => item.botName).join(', ') }}</span
                        >
                      </AppButton>
                    </div>
                  </td>
                </tr>
                <tr v-if="!loading && !packageInventory.length">
                  <td colspan="5" class="h-40 text-center text-text-muted">ไม่พบ Package</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="space-y-sm">
          <div
            class="flex flex-col gap-sm tablet:flex-row tablet:items-center tablet:justify-between"
          >
            <h3 class="text-xl font-semibold">Runtime</h3>
            <label class="relative block"
              ><Search
                :size="17"
                class="absolute left-sm top-1/2 -translate-y-1/2 text-text-muted" /><input
                v-model="runtimeSearch"
                class="field !mt-0 !pl-xl"
                placeholder="ค้นหา Runtime"
            /></label>
          </div>
          <div class="overflow-x-auto rounded-xl border border-border-default bg-bg-surface">
            <table class="w-full min-w-[860px] border-collapse text-left">
              <thead class="text-sm text-text-muted">
                <tr>
                  <th class="table-cell w-16">ลำดับ</th>
                  <th class="table-cell">ชื่อ</th>
                  <th class="table-cell">สถานะ</th>
                  <th class="table-cell">ใช้งานโดย</th>
                  <th class="table-cell text-center">การทำงาน</th>
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
                    SLOT-{{ runtime.slotNumber }} · {{ runtime.planName }}
                    <p class="text-xs font-normal text-text-muted">
                      ต่ออายุ ฿{{ (runtime.effectiveRenewalPriceSatang / 100).toLocaleString() }}
                    </p>
                  </td>
                  <td class="table-cell">
                    <span>{{ runtime.status }}</span>
                    <p class="text-xs text-text-muted">
                      {{ runtime.status === 'GRACE' ? 'ผ่อนผันถึง' : 'หมดอายุ' }}
                      {{ runtimeExpiry(runtime) }}
                    </p>
                  </td>
                  <td class="table-cell">
                    <AppTextField
                      :model-value="targetBotByRuntime[runtime.id]"
                      variant="dropdown"
                      label=""
                      :options="botOptions"
                      placeholder="เลือกบอท"
                      class="min-w-[140px]"
                      @update:model-value="(val) => handleBotSelectChange(runtime, val)"
                    />
                  </td>
                  <td class="table-cell">
                    <div class="flex flex-wrap items-center justify-center gap-md">
                      <AppToggle
                        :model-value="runtime.autoRenew"
                        :disabled="updatingAutoRenew"
                        label="Auto-renew"
                        @change="openAutoRenewModal(runtime)"
                      />
                      <AppButton
                        v-if="runtime.status === 'GRACE'"
                        variant="secondary"
                        @click="renew(runtime)"
                        >ต่ออายุทันที</AppButton
                      >
                    </div>
                  </td>
                </tr>
                <tr v-if="!loading && !visibleRuntimeSubscriptions.length">
                  <td colspan="5" class="h-40 text-center text-text-muted">ไม่พบ Runtime</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
    <AppModal
      v-model:open="showCreate"
      subtitle="My Bot"
      title="เพิ่มบอท"
      size="lg"
      :disabled="creating"
      @close="closeCreateDialog"
    >
      <form id="create-bot-form" class="grid gap-md tablet:grid-cols-2" @submit.prevent="submitBot">
        <AppTextField
          v-model="createForm.name"
          label="ชื่อบอท"
          placeholder="My Discord Bot"
          required
          :maxlength="100"
          :disabled="creating"
        />
        <AppTextField
          v-model="createForm.token"
          variant="secret"
          label="Bot Token"
          placeholder="Bot Token"
          autocomplete="new-password"
          :disabled="creating"
        />
        <AppTextField
          v-model="createForm.discordApplicationId"
          label="Discord Application ID"
          placeholder="Application ID"
          pattern="[0-9]{15,30}"
          :disabled="creating"
        />
        <AppTextField
          v-model="createForm.discordGuildId"
          label="Discord Guild ID"
          placeholder="Guild ID"
          pattern="[0-9]{15,30}"
          :disabled="creating"
        />
      </form>
      <template #actions>
        <AppButton type="button" variant="secondary" :disabled="creating" @click="closeCreateDialog"
          >ยกเลิก</AppButton
        >
        <AppButton
          type="submit"
          form="create-bot-form"
          :disabled="creating || !createForm.name.trim()"
        >
          {{ creating ? 'กำลังสร้าง…' : 'สร้างบอท' }}
        </AppButton>
      </template>
    </AppModal>

    <AppModal
      v-model:open="showAutoRenewModal"
      subtitle="Auto Renew"
      :title="
        selectedAutoRenewRuntime?.autoRenew
          ? 'ยืนยันปิดการต่ออายุอัตโนมัติ'
          : 'ยืนยันเปิดการต่ออายุอัตโนมัติ'
      "
      :disabled="updatingAutoRenew"
      @close="closeAutoRenewModal"
    >
      <p v-if="selectedAutoRenewRuntime" class="leading-relaxed">
        คุณต้องการ<span class="font-bold text-text-primary">{{
          selectedAutoRenewRuntime.autoRenew ? 'ปิด' : 'เปิด'
        }}</span
        >การต่ออายุอัตโนมัติ (Auto-renew) สำหรับ
        <span class="font-semibold text-text-primary"
          >SLOT-{{ selectedAutoRenewRuntime.slotNumber }} ·
          {{ selectedAutoRenewRuntime.planName }}</span
        >
        ใช่หรือไม่?
      </p>
      <template #actions>
        <AppButton
          type="button"
          variant="secondary"
          :disabled="updatingAutoRenew"
          @click="closeAutoRenewModal"
        >
          ยกเลิก
        </AppButton>
        <AppButton type="button" :disabled="updatingAutoRenew" @click="confirmToggleAutoRenew">
          {{
            updatingAutoRenew
              ? 'กำลังอัปเดต…'
              : selectedAutoRenewRuntime?.autoRenew
                ? 'ยืนยันปิด Auto-renew'
                : 'ยืนยันเปิด Auto-renew'
          }}
        </AppButton>
      </template>
    </AppModal>

    <AppModal
      v-model:open="showBindModal"
      subtitle="Runtime Assignment"
      title="ยืนยันการเปลี่ยนบอท"
      :disabled="updatingBind"
      @close="closeBindModal"
    >
      <p v-if="pendingBotBind" class="leading-relaxed">
        คุณต้องการผูก Runtime
        <span class="font-semibold text-text-primary"
          >SLOT-{{ pendingBotBind.runtime.slotNumber }} ·
          {{ pendingBotBind.runtime.planName }}</span
        >
        เข้ากับบอท
        <span class="font-bold text-text-primary">{{ pendingBotBind.newBotName }}</span> ใช่หรือไม่?
      </p>
      <template #actions>
        <AppButton
          type="button"
          variant="secondary"
          :disabled="updatingBind"
          @click="closeBindModal"
        >
          ยกเลิก
        </AppButton>
        <AppButton type="button" :disabled="updatingBind" @click="confirmBindBot">
          {{ updatingBind ? 'กำลังอัปเดต…' : 'ยืนยันเปลี่ยนบอท' }}
        </AppButton>
      </template>
    </AppModal>

    <AppModal
      v-model:open="showInstallModal"
      subtitle="Package Installation"
      title="ยืนยันการใช้ Package"
      :disabled="Boolean(installingLicenseId)"
      @close="closeInstallModal"
    >
      <p v-if="pendingInstall" class="leading-relaxed">
        คุณต้องการใช้ Package
        <span class="font-bold text-text-primary">{{ pendingInstall.license.featureName }}</span>
        ให้กับบอท
        <span class="font-bold text-text-primary">{{ pendingInstall.botName }}</span>
        ใช่หรือไม่?
      </p>
      <template #actions>
        <AppButton
          type="button"
          variant="secondary"
          :disabled="Boolean(installingLicenseId)"
          @click="closeInstallModal"
        >
          ยกเลิก
        </AppButton>
        <AppButton
          type="button"
          :disabled="Boolean(installingLicenseId)"
          @click="confirmInstallPackage"
        >
          {{ installingLicenseId ? 'กำลังติดตั้ง…' : 'ยืนยันการใช้ Package' }}
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
