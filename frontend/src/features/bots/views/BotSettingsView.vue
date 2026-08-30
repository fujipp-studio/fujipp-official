<script setup lang="ts">
import { useBotSettingsData } from '../composables/useBotSettingsData'
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { icons } from '../../../config'
import {
  updateBot,
  updateBotDiscordToken,
  upgradeFeatureLicense,
  type FeatureLicense,
} from '@/features/bots/api'
import { updateAdminBotSettings } from '@/features/admin/api/bots'
import { renewRuntime, updateRuntimeAutoRenew } from '@/features/bots/runtime-api'
import { AppButton, AppIcon, AppModal, AppTextField, AppToast, AppToggle } from '../../../shared/ui'
import { useAuthStore } from '../../../stores'

type SettingsView = 'main' | 'bot-config' | 'runtime' | 'packages'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { session, initialized } = storeToRefs(authStore)
const { locale, t } = useI18n()
const botId = computed(() => String(route.params.botId ?? ''))
const adminMode = computed(() => route.path.startsWith('/admin/bots/'))
const data = useBotSettingsData({ botId, adminMode })
const { bot, licenses, runtimeSubscriptions } = data
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
const upgradingLicenseId = ref('')
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

async function loadPage(force = false) {
  await data.load(force)
  if (data.error.value) showToast(data.error.value, 'error')
  else syncForm()
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
    data.setBot(updated)
    form.value.token = ''
    showToast(t('botSettings.botSettingsSavedRestartTheBotTo'), 'success')
    if (!adminMode.value) activeView.value = 'main'
  } catch (cause) {
    showToast(
      cause instanceof Error ? cause.message : t('botSettings.unableToSaveBotSettings'),
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
    name: adminMode.value ? 'admin-bot-feature-settings' : 'bot-feature-settings',
    params: { botId: botId.value, licenseId },
  })
}

async function upgradeLicense(license: FeatureLicense) {
  if (!session.value || adminMode.value || !license.upgradeAvailable) return
  upgradingLicenseId.value = license.id
  try {
    const updated = await upgradeFeatureLicense(license.id, session.value)
    licenses.value = licenses.value.map((item) => (item.id === updated.id ? updated : item))
    showToast(
      text(
        `Upgraded to version ${updated.version}.`,
        `อัปเกรดเป็นเวอร์ชัน ${updated.version} แล้ว`,
      ),
      'success',
    )
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : t('botSettings.upgradeFailed'), 'error')
  } finally {
    upgradingLicenseId.value = ''
  }
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
    showToast(t('botSettings.automaticRenewalUpdated'), 'success')
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : t('botSettings.updateFailed'), 'error')
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
    showToast(t('botSettings.runtimeRenewed'), 'success')
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : t('botSettings.renewalFailed'), 'error')
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
        :aria-label="t('botSettings.settingsMenu')"
      >
        <div class="setting-grid">
          <button class="setting-card" type="button" @click="openView('bot-config')">
            <AppIcon class="setting-card-icon" :source="icons.social.discord" />
            <span>{{ t('botSettings.botConfig') }}</span>
          </button>
          <button class="setting-card" type="button" @click="openView('runtime')">
            <AppIcon class="setting-card-icon" :source="icons.shop.server" />
            <span>{{ t('botSettings.runtimeSettings') }}</span>
          </button>
          <button class="setting-card" type="button" @click="openView('packages')">
            <AppIcon class="setting-card-icon" :source="icons.shop.package" />
            <span>{{ t('botSettings.packageSettings') }}</span>
          </button>
        </div>
      </section>

      <section v-else id="bot-settings-panel" key="detail" class="space-y-lg">
        <section v-if="activeView === 'bot-config'" class="config-card">
          <div class="config-content">
            <h2 class="text-2xl font-bold">{{ t('botSettings.botConfig') }}</h2>
            <form class="space-y-md" @submit.prevent="saveBot">
              <AppTextField
                v-model="form.name"
                :label="t('botSettings.botName')"
                required
                :maxlength="100"
                :disabled="saving"
              />
              <AppTextField
                v-model="form.token"
                variant="secret"
                :label="t('botSettings.botTokenLeaveBlankToKeepCurrent')"
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
                  >{{ t('botSettings.cancel') }}</AppButton
                >
                <AppButton
                  class="settings-hug"
                  type="submit"
                  :left-icon="icons.action.save"
                  :disabled="saving || !form.name.trim()"
                  >{{ saving ? t('botSettings.saving') : t('botSettings.save') }}</AppButton
                >
              </div>
            </form>
          </div>
        </section>

        <section v-else-if="activeView === 'runtime'" class="items-card">
          <h2 class="text-2xl font-bold">{{ t('botSettings.runtimeSettings') }}</h2>
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
                <dt>{{ t('botSettings.connectedBot') }}</dt>
                <dd>{{ assignedRuntime.botName ?? bot?.name ?? '—' }}</dd>
              </div>
              <div>
                <dt>{{ t('botSettings.currentPeriodEnds') }}</dt>
                <dd>{{ formatRuntimeDate(assignedRuntime.currentPeriodEnd) }}</dd>
              </div>
              <div>
                <dt>{{ t('botSettings.automaticRenewal') }}</dt>
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
                <dt>{{ t('botSettings.gracePeriodEnds') }}</dt>
                <dd>{{ formatRuntimeDate(assignedRuntime.graceUntil) }}</dd>
              </div>
            </dl>
            <div v-if="assignedRuntime.status === 'GRACE'" class="runtime-actions">
              <AppButton
                class="settings-hug"
                :disabled="runtimeBusy"
                @click="renewAssignedRuntime"
                >{{ t('botSettings.renewNow') }}</AppButton
              >
            </div>
          </article>
          <p v-else class="py-2xl text-center text-text-muted">
            {{ t('botSettings.noRuntimeAssignedToThisBot') }}
          </p>
        </section>

        <section v-else class="items-card">
          <h2 class="text-2xl font-bold">{{ t('botSettings.packageSettings') }}</h2>
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
                {{ t('botSettings.settings') }}
              </AppButton>
              <AppButton
                v-if="!adminMode && license.upgradeAvailable"
                class="settings-hug"
                :disabled="Boolean(upgradingLicenseId)"
                @click="upgradeLicense(license)"
              >
                {{
                  upgradingLicenseId === license.id
                    ? t('botSettings.upgrading')
                    : text(
                        `Upgrade to v${license.latestVersion}`,
                        `อัปเกรดเป็น v${license.latestVersion}`,
                      )
                }}
              </AppButton>
            </article>
          </div>
          <p v-else class="py-2xl text-center text-text-muted">
            {{ t('botSettings.noPackagesAssignedToThisBot') }}
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
          ? t('botSettings.confirmDisablingAutomaticRenewal')
          : t('botSettings.confirmEnablingAutomaticRenewal')
      "
      :disabled="runtimeBusy"
      @close="closeAutoRenewModal"
    >
      <p v-if="assignedRuntime" class="leading-relaxed">
        {{ t('botSettings.areYouSureYouWantTo') }}
        <span class="font-bold text-text-primary">{{
          assignedRuntime.autoRenew ? t('botSettings.disable') : t('botSettings.enable')
        }}</span>
        {{ t('botSettings.automaticRenewalAutoRenewFor') }}
        <span class="font-semibold text-text-primary"
          >SLOT-{{ assignedRuntime.slotNumber }} · {{ assignedRuntime.planName }}</span
        >
        {{ t('botSettings.label') }}
      </p>
      <template #actions>
        <AppButton
          type="button"
          variant="secondary"
          :disabled="runtimeBusy"
          @click="closeAutoRenewModal"
        >
          {{ t('botSettings.cancel') }}
        </AppButton>
        <AppButton type="button" :disabled="runtimeBusy" @click="confirmToggleAutoRenew">
          {{
            runtimeBusy
              ? t('botSettings.updating')
              : assignedRuntime?.autoRenew
                ? t('botSettings.confirmDisableAutoRenew')
                : t('botSettings.confirmEnableAutoRenew')
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
