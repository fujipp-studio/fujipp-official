<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

import {
  controlBot,
  controlAdminBot,
  fetchAdminBotSettings,
  fetchBots,
  fetchFeatureLicenses,
  type FeatureLicense,
  type UserBot,
} from '../../../services/backend'
import { AppSectionIndicator } from '../../../shared/ui'
import { useAuthStore } from '../../../stores'
import BotSettingsShell from '../components/BotSettingsShell.vue'

const route = useRoute(),
  router = useRouter(),
  auth = useAuthStore()
const { session, initialized } = storeToRefs(auth)
const bot = ref<UserBot | null>(null),
  licenses = ref<FeatureLicense[]>([]),
  loading = ref(true),
  controlling = ref(false)
const transitionName = ref('bot-child-forward')
let refreshTimer: ReturnType<typeof setInterval> | undefined
let refreshing = false
const botId = computed(() => String(route.params.botId ?? ''))
const adminMode = computed(() => route.path.startsWith('/admin/bots/'))
const licenseName = computed(
  () =>
    licenses.value.find((item) => item.id === String(route.params.licenseId ?? ''))?.featureName ??
    'Feature',
)
const trail = computed(() => {
  if (route.name === 'bot-settings' || route.name === 'admin-bot-settings') return []
  if (route.name === 'bot-config-settings' || route.name === 'admin-bot-config-settings')
    return ['Bot config']
  if (route.name === 'bot-runtime-settings' || route.name === 'admin-bot-runtime-settings')
    return ['Runtime settings']
  if (route.name === 'bot-package-settings' || route.name === 'admin-bot-package-settings')
    return ['Package settings']
  const result = ['Package settings', licenseName.value]
  if (route.name === 'bot-feature-embed-settings') result.push('Embed')
  if (route.name === 'bot-feature-components-v2-settings') result.push('Components V2')
  return result
})
const featureRouteNames = new Set([
  'bot-feature-settings',
  'bot-feature-embed-settings',
  'bot-feature-components-v2-settings',
])
const isFeatureRoute = computed(() => featureRouteNames.has(String(route.name)))
const shellSections = [
  { id: 'bot-settings-overview', label: 'Bot' },
  { id: 'bot-settings-content', label: 'Settings' },
]
function routeDepth(name: unknown) {
  if (name === 'bot-settings') return 0
  if (
    name === 'bot-config-settings' ||
    name === 'bot-runtime-settings' ||
    name === 'bot-package-settings'
  )
    return 1
  if (name === 'bot-feature-settings') return 2
  return 3
}

function botChanged(current: UserBot | null, next: UserBot | null) {
  if (!current || !next) return current !== next
  return (
    current.id !== next.id ||
    current.name !== next.name ||
    current.discordAvatarUrl !== next.discordAvatarUrl ||
    current.status !== next.status ||
    current.desiredState !== next.desiredState
  )
}

function updateBotIfChanged(next: UserBot | null) {
  if (botChanged(bot.value, next)) bot.value = next
}

async function load() {
  if (!initialized.value) await auth.initialize()
  if (!session.value) return
  try {
    if (adminMode.value) {
      bot.value = await fetchAdminBotSettings(botId.value, session.value)
      licenses.value = []
      return
    }
    const [bots, allLicenses] = await Promise.all([
      fetchBots(session.value),
      fetchFeatureLicenses(session.value),
    ])
    bot.value = bots.find((item) => item.id === botId.value) ?? null
    licenses.value = allLicenses
  } finally {
    loading.value = false
  }
}
async function refreshBot() {
  if (!session.value || refreshing) return
  refreshing = true
  try {
    if (adminMode.value) {
      updateBotIfChanged(await fetchAdminBotSettings(botId.value, session.value))
      return
    }
    const updated = (await fetchBots(session.value)).find((item) => item.id === botId.value)
    if (updated) updateBotIfChanged(updated)
  } catch {
    /* retry */
  } finally {
    refreshing = false
  }
}
async function runControl(action: 'start' | 'stop' | 'restart') {
  if (!session.value || !bot.value) return
  controlling.value = true
  try {
    if (adminMode.value) {
      await controlAdminBot(bot.value.id, action, session.value)
      bot.value = await fetchAdminBotSettings(bot.value.id, session.value)
    } else {
      bot.value = await controlBot(bot.value.id, action, session.value)
    }
  } finally {
    controlling.value = false
  }
}
function goMain() {
  if (adminMode.value) {
    void router.push({ name: 'admin-bot-settings', params: { botId: botId.value } })
    return
  }
  void router.push({ name: 'bot-settings', params: { botId: botId.value } })
}
function goBack() {
  if (adminMode.value) {
    void router.push({ name: 'admin-bots' })
    return
  }
  if (route.name === 'bot-settings') {
    void router.push({ name: 'my-bot' })
    return
  }
  if (
    route.name === 'bot-feature-embed-settings' ||
    route.name === 'bot-feature-components-v2-settings'
  ) {
    void router.push({
      name: 'bot-feature-settings',
      params: { botId: botId.value, licenseId: route.params.licenseId },
    })
    return
  }
  if (route.name === 'bot-feature-settings') {
    void router.push({ name: 'bot-package-settings', params: { botId: botId.value } })
    return
  }
  goMain()
}
function openTrail(index: number) {
  if (index === 0) {
    void router.push({ name: 'bot-package-settings', params: { botId: botId.value } })
    return
  }
  if (index === 1 && route.params.licenseId) {
    void router.push({
      name: 'bot-feature-settings',
      params: { botId: botId.value, licenseId: route.params.licenseId },
    })
  }
}
watch(
  () => route.name,
  (name, previous) => {
    transitionName.value =
      routeDepth(name) < routeDepth(previous) ? 'bot-child-backward' : 'bot-child-forward'
  },
)
onMounted(async () => {
  await load()
  refreshTimer = setInterval(() => void refreshBot(), 3000)
})
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <main class="min-h-screen bg-bg-default pt-24 text-text-primary desktop:pt-28">
    <div class="page-container pb-5xl">
      <div id="bot-settings-overview">
        <BotSettingsShell
          :bot="bot"
          :loading="loading"
          :controlling="controlling"
          :trail="trail"
          @back="goBack"
          @main="goMain"
          @trail="openTrail"
          @control="runControl"
        />
      </div>
      <div id="bot-settings-content" class="bot-child-stage">
        <RouterView v-slot="{ Component, route: childRoute }">
          <Transition :name="transitionName" mode="out-in" appear>
            <component :is="Component" :key="childRoute.fullPath" />
          </Transition>
        </RouterView>
      </div>
      <AppSectionIndicator
        v-if="!isFeatureRoute"
        :sections="shellSections"
        aria-label="Bot settings sections"
      />
    </div>
  </main>
</template>

<style scoped>
.bot-child-stage {
  overflow-x: clip;
}
.bot-child-forward-enter-active,
.bot-child-forward-leave-active,
.bot-child-backward-enter-active,
.bot-child-backward-leave-active {
  transition:
    opacity 220ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}
.bot-child-forward-enter-from,
.bot-child-backward-leave-to {
  opacity: 0;
  transform: translateX(var(--space-3xl));
}
.bot-child-forward-leave-to,
.bot-child-backward-enter-from {
  opacity: 0;
  transform: translateX(calc(var(--space-3xl) * -1));
}
@media (prefers-reduced-motion: reduce) {
  .bot-child-forward-enter-active,
  .bot-child-forward-leave-active,
  .bot-child-backward-enter-active,
  .bot-child-backward-leave-active {
    transition: none;
  }
}
</style>
