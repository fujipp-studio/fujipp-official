<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { icons } from '../../../config'
import {
  fetchBots,
  fetchAdminBotSettings,
  fetchFeatureLicenses,
  fetchRuntimeSubscriptions,
  renewRuntime,
  updateBot,
  updateAdminBotSettings,
  updateBotDiscordToken,
  updateRuntimeAutoRenew,
  type FeatureLicense,
  type RuntimeSubscription,
  type UserBot,
} from '../../../services/backend'
import { AppButton, AppIcon, AppModal, AppTextField, AppToast, AppToggle } from '../../../shared/ui'
import { useAuthStore } from '../../../stores'

type SettingsView = 'main' | 'bot-config' | 'runtime' | 'packages'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { session, initialized } = storeToRefs(authStore)
const { locale } = useI18n()
const botId = computed(() => String(route.params.botId ?? ''))
const adminMode = computed(() => route.path.startsWith('/admin/bots/'))
const bot = ref<UserBot | null>(null)
const licenses = ref<FeatureLicense[]>([])
const runtimeSubscriptions = ref<RuntimeSubscription[]>([])
function routeView(): SettingsView {
  if (route.name === 'bot-config-settings' || route.name === 'admin-bot-config-settings')
    return 'bot-config'
  if (route.name === 'bot-runtime-settings' || route.name === 'admin-bot-runtime-settings')
    return 'runtime'
  if (route.name === 'bot-package-settings' || route.name === 'admin-bot-package-settings')
    return 'packages'
  return 'main'
}
const activeView = ref<SettingsView>(routeView())
const transitionName = ref('settings-forward')
const saving = ref(false)
const runtimeBusy = ref(false)
const toastOpen = ref(false)
const toastMessage = ref('')
const toastVariant = ref<'info' | 'success' | 'error'>('info')
const form = ref({ name: '', token: '', discordApplicationId: '', discordGuildId: '' })

const text = (english: string, thai: string) => (locale.value === 'th' ? thai : english)

const assignedLicenses = computed(() =>
  licenses.value.filter((license) =>
    license.installations.some((installation) => installation.botId === botId.value),
  ),
)
const assignedRuntime = computed(
  () => runtimeSubscriptions.value.find((runtime) => runtime.botId === botId.value) ?? null,
)
const packageLicenses = computed(() =>
  assignedLicenses.value.filter(
    (license) => !`${license.featureCode} ${license.featureName}`.toLowerCase().includes('runtime'),
  ),
)

function showToast(message: string, variant: 'info' | 'success' | 'error' = 'info') {
  toastMessage.value = message
  toastVariant.value = variant
  toastOpen.value = false
  requestAnimationFrame(() => (toastOpen.value = true))
}

function syncForm() {
  if (!bot.value) return
  form.value = {
    name: bot.value.name,
    token: '',
    discordApplicationId: bot.value.discordApplicationId ?? '',
    discordGuildId: bot.value.discordGuildId ?? '',
  }
}

async function loadPage() {
  if (!session.value) return
  try {
    if (adminMode.value) {
      bot.value = await fetchAdminBotSettings(botId.value, session.value)
      licenses.value = []
      runtimeSubscriptions.value = []
      syncForm()
      return
    }
    const [allBots, allLicenses, allRuntimeSubscriptions] = await Promise.all([
      fetchBots(session.value),
      fetchFeatureLicenses(session.value),
      fetchRuntimeSubscriptions(session.value),
    ])
    bot.value = allBots.find((item) => item.id === botId.value) ?? null
    licenses.value = allLicenses
    runtimeSubscriptions.value = allRuntimeSubscriptions
    if (!bot.value) {
      showToast(text('Bot not found.', 'ไม่พบบอทนี้'), 'error')
      return
    }
    syncForm()
  } catch (cause) {
    showToast(
      cause instanceof Error
        ? cause.message
        : text('Unable to load bot settings.', 'โหลดการตั้งค่าบอทไม่สำเร็จ'),
      'error',
    )
  } finally {
    // The persistent parent shell owns the route-level loading state.
  }
}

async function saveBot() {
  if (!session.value || !bot.value || !form.value.name.trim()) return
  saving.value = true
  try {
    const input = {
      name: form.value.name.trim(),
      discordApplicationId: form.value.discordApplicationId.trim() || null,
      discordGuildId: form.value.discordGuildId.trim() || null,
    }
    const updated = adminMode.value
      ? await updateAdminBotSettings(bot.value.id, input, session.value)
      : await updateBot(bot.value.id, input, session.value)
    if (form.value.token.trim() && !adminMode.value) {
      await updateBotDiscordToken(bot.value.id, form.value.token.trim(), session.value)
    }
    bot.value = updated
    form.value.token = ''
    showToast(
      text(
        'Bot settings saved. Restart the bot to apply the changes.',
        'บันทึกการตั้งค่าบอทแล้ว รีสตาร์ตบอทเพื่อใช้ค่าใหม่',
      ),
      'success',
    )
    if (!adminMode.value) activeView.value = 'main'
  } catch (cause) {
    showToast(
      cause instanceof Error
        ? cause.message
        : text('Unable to save bot settings.', 'บันทึกบอทไม่สำเร็จ'),
      'error',
    )
  } finally {
    saving.value = false
  }
}

function openView(view: SettingsView) {
  if (view === 'bot-config') syncForm()
  transitionName.value = view === 'main' ? 'settings-backward' : 'settings-forward'
  const routeName = {
    main: 'bot-settings',
    'bot-config': 'bot-config-settings',
    runtime: 'bot-runtime-settings',
    packages: 'bot-package-settings',
  }[view]
  const adminRouteName = {
    main: 'admin-bot-settings',
    'bot-config': 'admin-bot-config-settings',
    runtime: 'admin-bot-runtime-settings',
    packages: 'admin-bot-package-settings',
  }[view]
  void router.push({
    name: adminMode.value ? adminRouteName : routeName,
    params: { botId: botId.value },
  })
}

function openFeature(licenseId: string) {
  void router.push({
    name: 'bot-feature-settings',
    params: { botId: botId.value, licenseId },
  })
}

watch(
  () => route.name,
  () => {
    const target = routeView()
    transitionName.value = target === 'main' ? 'settings-backward' : 'settings-forward'
    activeView.value = target
  },
)

function formatRuntimeDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const showAutoRenewModal = ref(false)

function openAutoRenewModal() {
  showAutoRenewModal.value = true
}

function closeAutoRenewModal() {
  if (runtimeBusy.value) return
  showAutoRenewModal.value = false
}

async function confirmToggleAutoRenew() {
  if (!session.value || !assignedRuntime.value) return
  runtimeBusy.value = true
  try {
    const updated = await updateRuntimeAutoRenew(
      assignedRuntime.value.id,
      !assignedRuntime.value.autoRenew,
      session.value,
    )
    runtimeSubscriptions.value = runtimeSubscriptions.value.map((item) =>
      item.id === updated.id ? updated : item,
    )
    showToast(text('Automatic renewal updated.', 'อัปเดตการต่ออายุอัตโนมัติแล้ว'), 'success')
  } catch (cause) {
    showToast(
      cause instanceof Error ? cause.message : text('Update failed.', 'อัปเดตไม่สำเร็จ'),
      'error',
    )
  } finally {
    runtimeBusy.value = false
    showAutoRenewModal.value = false
  }
}

async function renewAssignedRuntime() {
  if (!session.value || !assignedRuntime.value) return
  runtimeBusy.value = true
  try {
    const updated = await renewRuntime(assignedRuntime.value.id, session.value)
    runtimeSubscriptions.value = runtimeSubscriptions.value.map((item) =>
      item.id === updated.id ? updated : item,
    )
    showToast(text('Runtime renewed.', 'ต่ออายุ Runtime แล้ว'), 'success')
  } catch (cause) {
    showToast(
      cause instanceof Error ? cause.message : text('Renewal failed.', 'ต่ออายุไม่สำเร็จ'),
      'error',
    )
  } finally {
    runtimeBusy.value = false
  }
}

onMounted(async () => {
  if (!initialized.value) await authStore.initialize()
  await loadPage()
})
</script>

<template>
  <div class="space-y-xl">
    <Transition :name="transitionName" mode="out-in">
      <section
        v-if="activeView === 'main'"
        id="bot-settings-panel"
        key="main"
        class="setting-menu"
        :aria-label="text('Settings menu', 'เมนูตั้งค่า')"
      >
        <div class="setting-grid">
          <button class="setting-card" type="button" @click="openView('bot-config')">
            <AppIcon
              class="setting-card-icon"
              :source="icons.social.discord"
            />
            <span>{{ text('Bot config', 'ตั้งค่าบอท') }}</span>
          </button>
          <button class="setting-card" type="button" @click="openView('runtime')">
            <AppIcon
              class="setting-card-icon"
              :source="icons.shop.server"
            />
            <span>{{ text('Runtime settings', 'ตั้งค่า Runtime') }}</span>
          </button>
          <button class="setting-card" type="button" @click="openView('packages')">
            <AppIcon
              class="setting-card-icon"
              :source="icons.shop.package"
            />
            <span>{{ text('Package settings', 'ตั้งค่า Package') }}</span>
          </button>
        </div>
      </section>

      <section v-else id="bot-settings-panel" key="detail" class="space-y-lg">
        <section v-if="activeView === 'bot-config'" class="config-card">
          <div class="config-content">
            <h2 class="text-2xl font-bold">{{ text('Bot config', 'ตั้งค่าบอท') }}</h2>
            <form class="space-y-md" @submit.prevent="saveBot">
              <AppTextField
                v-model="form.name"
                :label="text('Bot name', 'ชื่อบอท')"
                required
                :maxlength="100"
                :disabled="saving"
              />
              <AppTextField
                v-model="form.token"
                variant="secret"
                :label="
                  text(
                    'Bot Token (leave blank to keep current)',
                    'Bot Token (เว้นว่างเพื่อใช้ค่าเดิม)',
                  )
                "
                placeholder="••••••••••••••••"
                autocomplete="new-password"
                :disabled="saving"
              />
              <AppTextField
                v-model="form.discordApplicationId"
                label="Application ID (Client ID)"
                placeholder="Application ID"
                pattern="[0-9]{15,30}"
                :disabled="saving"
              />
              <AppTextField
                v-model="form.discordGuildId"
                label="Server ID (Guild)"
                placeholder="Server ID"
                pattern="[0-9]{15,30}"
                :disabled="saving"
              />
              <div class="config-actions">
                <AppButton
                  class="settings-hug"
                  type="button"
                  :disabled="saving"
                  @click="openView('main')"
                  >{{ text('Cancel', 'ยกเลิก') }}</AppButton
                >
                <AppButton
                  class="settings-hug"
                  type="submit"
                  :left-icon="icons.action.save"
                  :disabled="saving || !form.name.trim()"
                  >{{
                    saving ? text('Saving…', 'กำลังบันทึก…') : text('Save', 'บันทึก')
                  }}</AppButton
                >
              </div>
            </form>
          </div>
        </section>

        <section v-else-if="activeView === 'runtime'" class="items-card">
          <h2 class="text-2xl font-bold">{{ text('Runtime settings', 'ตั้งค่า Runtime') }}</h2>
          <article v-if="assignedRuntime" class="runtime-detail">
            <div class="runtime-detail-header">
              <div>
                <p class="text-sm font-semibold uppercase tracking-widest text-text-muted">
                  SLOT-{{ assignedRuntime.slotNumber }}
                </p>
                <h3 class="mt-xs text-xl font-extrabold">{{ assignedRuntime.planName }}</h3>
              </div>
              <span
                class="runtime-status"
                :class="{ 'runtime-status--grace': assignedRuntime.status === 'GRACE' }"
                >{{ assignedRuntime.status }}</span
              >
            </div>
            <dl class="runtime-detail-grid">
              <div>
                <dt>{{ text('Connected bot', 'บอทที่เชื่อม') }}</dt>
                <dd>{{ assignedRuntime.botName ?? bot?.name ?? '—' }}</dd>
              </div>
              <div>
                <dt>{{ text('Current period ends', 'หมดอายุรอบปัจจุบัน') }}</dt>
                <dd>{{ formatRuntimeDate(assignedRuntime.currentPeriodEnd) }}</dd>
              </div>
              <div>
                <dt>{{ text('Automatic renewal', 'ต่ออายุอัตโนมัติ') }}</dt>
                <dd class="mt-xs">
                  <AppToggle
                    :model-value="assignedRuntime.autoRenew"
                    :disabled="runtimeBusy"
                    label="Auto-renew"
                    @change="openAutoRenewModal"
                  />
                </dd>
              </div>
              <div v-if="assignedRuntime.status === 'GRACE'">
                <dt>{{ text('Grace period ends', 'สิ้นสุดระยะผ่อนผัน') }}</dt>
                <dd>{{ formatRuntimeDate(assignedRuntime.graceUntil) }}</dd>
              </div>
            </dl>
            <div v-if="assignedRuntime.status === 'GRACE'" class="runtime-actions">
              <AppButton
                class="settings-hug"
                :disabled="runtimeBusy"
                @click="renewAssignedRuntime"
                >{{ text('Renew now', 'ต่ออายุทันที') }}</AppButton
              >
            </div>
          </article>
          <p v-else class="py-2xl text-center text-text-muted">
            {{ text('No Runtime assigned to this bot.', 'บอทนี้ยังไม่มี Runtime') }}
          </p>
        </section>

        <section v-else class="items-card">
          <h2 class="text-2xl font-bold">{{ text('Package settings', 'ตั้งค่า Package') }}</h2>
          <div v-if="packageLicenses.length" class="item-list">
            <article v-for="license in packageLicenses" :key="license.id" class="setting-item">
              <div>
                <h3 class="font-bold">{{ license.featureName }}</h3>
                <p class="text-sm text-text-muted">v{{ license.version }} · {{ license.status }}</p>
              </div>
              <AppButton
                class="settings-hug"
                variant="secondary"
                :left-icon="icons.action.setting"
                @click="openFeature(license.id)"
              >
                {{ text('Settings', 'ตั้งค่า') }}
              </AppButton>
            </article>
          </div>
          <p v-else class="py-2xl text-center text-text-muted">
            {{ text('No Packages assigned to this bot.', 'บอทนี้ยังไม่มี Package') }}
          </p>
        </section>
      </section>
    </Transition>

    <AppToast v-model:open="toastOpen" :message="toastMessage" :variant="toastVariant" />

    <AppModal
      v-model:open="showAutoRenewModal"
      subtitle="Auto Renew"
      :title="
        assignedRuntime?.autoRenew
          ? text('Confirm disabling automatic renewal', 'ยืนยันปิดการต่ออายุอัตโนมัติ')
          : text('Confirm enabling automatic renewal', 'ยืนยันเปิดการต่ออายุอัตโนมัติ')
      "
      :disabled="runtimeBusy"
      @close="closeAutoRenewModal"
    >
      <p v-if="assignedRuntime" class="leading-relaxed">
        {{ text('Are you sure you want to', 'คุณต้องการ') }}
        <span class="font-bold text-text-primary">{{
          assignedRuntime.autoRenew ? text('disable', 'ปิด') : text('enable', 'เปิด')
        }}</span>
        {{ text('automatic renewal (Auto-renew) for', 'การต่ออายุอัตโนมัติ (Auto-renew) สำหรับ') }}
        <span class="font-semibold text-text-primary"
          >SLOT-{{ assignedRuntime.slotNumber }} · {{ assignedRuntime.planName }}</span
        >
        {{ text('?', 'ใช่หรือไม่?') }}
      </p>
      <template #actions>
        <AppButton
          type="button"
          variant="secondary"
          :disabled="runtimeBusy"
          @click="closeAutoRenewModal"
        >
          {{ text('Cancel', 'ยกเลิก') }}
        </AppButton>
        <AppButton type="button" :disabled="runtimeBusy" @click="confirmToggleAutoRenew">
          {{
            runtimeBusy
              ? text('Updating…', 'กำลังอัปเดต…')
              : assignedRuntime?.autoRenew
                ? text('Confirm disable Auto-renew', 'ยืนยันปิด Auto-renew')
                : text('Confirm enable Auto-renew', 'ยืนยันเปิด Auto-renew')
          }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.settings-hero {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  view-transition-name: bot-settings-hero;
}
.settings-hug {
  width: auto;
}
.bot-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xl);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  view-transition-name: bot-settings-summary;
}
.bot-identity,
.bot-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}
.bot-avatar {
  width: 6.25rem;
  height: 6.25rem;
  flex: 0 0 6.25rem;
  border-radius: var(--radius-lg);
  object-fit: cover;
}
.bot-avatar-fallback {
  display: grid;
  place-items: center;
  background: var(--color-bg-elevated);
  font-size: 2rem;
  font-weight: 800;
}
.status-label {
  display: inline-block;
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: 800;
}
.status-online {
  color: var(--color-success-text);
}
.status-offline {
  color: var(--color-error-text);
}
.setting-menu {
  display: grid;
  gap: var(--spacing-lg);
}
.setting-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-xl);
}
.setting-card {
  display: flex;
  aspect-ratio: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  font: inherit;
  cursor: pointer;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}
.setting-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-strong);
  background: var(--color-bg-surface-hover);
}
.setting-card:focus-visible {
  outline: 2px solid var(--color-border-accent);
  outline-offset: 3px;
}
.setting-card-icon {
  width: var(--icon-size-64);
  height: var(--icon-size-64);
}
.settings-breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: 600;
  view-transition-name: bot-settings-breadcrumb;
}
.settings-breadcrumb button {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-decoration: none;
}
.settings-breadcrumb button:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.breadcrumb-trail {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  animation: breadcrumb-reveal 260ms ease-out both;
}
.config-card,
.items-card {
  padding: var(--spacing-2xl) var(--spacing-lg);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
}
.config-content {
  width: min(100%, 30rem);
  margin-inline: auto;
}
.config-content h2 {
  margin-bottom: var(--spacing-xl);
}
.config-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-sm);
}
.item-list {
  display: grid;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}
.runtime-detail {
  display: grid;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
}
.runtime-detail-header,
.runtime-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}
.runtime-status {
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius-full);
  color: var(--color-success-text);
  font-size: var(--font-size-xs);
  font-weight: 700;
}
.runtime-status--grace {
  border-color: var(--color-warning-border);
  color: var(--color-warning-text);
}
.runtime-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-sm);
}
.runtime-detail-grid > div {
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
}
.runtime-detail-grid dt {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.runtime-detail-grid dd {
  margin-top: var(--spacing-xs);
  font-weight: 700;
}
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}
.settings-forward-enter-active,
.settings-forward-leave-active,
.settings-backward-enter-active,
.settings-backward-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms ease;
}
.settings-forward-enter-from,
.settings-backward-leave-to {
  opacity: 0;
  transform: translateX(var(--spacing-xl));
}
.settings-forward-leave-to,
.settings-backward-enter-from {
  opacity: 0;
  transform: translateX(calc(var(--spacing-xl) * -1));
}
@keyframes breadcrumb-reveal {
  from {
    opacity: 0;
    transform: translateX(calc(var(--spacing-sm) * -1));
  }
}
@media (min-width: 40rem) {
  .settings-hero {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
@media (max-width: 47.99rem) {
  .bot-summary {
    align-items: stretch;
    flex-direction: column;
  }
  .bot-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .setting-grid {
    grid-template-columns: 1fr;
  }
  .setting-card {
    aspect-ratio: auto;
    min-height: 10rem;
  }
  .config-actions,
  .setting-item,
  .runtime-detail-header,
  .runtime-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .runtime-detail-grid {
    grid-template-columns: 1fr;
  }
  .settings-hug {
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .setting-card,
  .settings-forward-enter-active,
  .settings-forward-leave-active,
  .settings-backward-enter-active,
  .settings-backward-leave-active {
    transition: none;
  }
  .breadcrumb-trail {
    animation: none;
  }
}
</style>
