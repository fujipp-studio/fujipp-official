<script setup lang="ts">
import { createBotSettingsData, botSettingsDataKey } from '../composables/useBotSettingsData'
import AppRequestError from '@/shared/ui/feedback/AppRequestError.vue'
import { computed, onMounted, provide } from 'vue'

import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { AppSectionIndicator } from '../../../shared/ui'

import BotSettingsShell from '../components/BotSettingsShell.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const botId = computed(() => String(route.params.botId ?? ''))
const adminMode = computed(() => route.path.startsWith('/admin/bots/'))
const data = createBotSettingsData({ botId, adminMode })
provide(botSettingsDataKey, data)
const { bot, licenses, loading, controlling, controlAction, error, runControl } = data
const currentLicense = computed(() =>
  licenses.value.find((item) => item.id === String(route.params.licenseId ?? '')),
)
const isRuntimeAlert = computed(() => currentLicense.value?.featureCode === 'runtime-expiry-alert')
const featureParentRoute = computed(
  () =>
    `${adminMode.value ? 'admin-' : ''}bot-${isRuntimeAlert.value ? 'runtime' : 'package'}-settings`,
)
const trail = computed(() => {
  if (route.name === 'bot-settings' || route.name === 'admin-bot-settings') return []
  if (route.name === 'bot-config-settings' || route.name === 'admin-bot-config-settings')
    return [t('botSettings.botConfig')]
  if (route.name === 'bot-runtime-settings' || route.name === 'admin-bot-runtime-settings')
    return [t('botSettings.runtimeSettings')]
  if (route.name === 'bot-package-settings' || route.name === 'admin-bot-package-settings')
    return [t('botSettings.packageSettings')]
  const result = [
    t(isRuntimeAlert.value ? 'botSettings.runtimeSettings' : 'botSettings.packageSettings'),
    currentLicense.value?.featureName ?? t('botSettings.featureFallback'),
  ]
  if (
    route.name === 'bot-feature-embed-settings' ||
    route.name === 'admin-bot-feature-embed-settings'
  )
    result.push('Embed')
  if (
    route.name === 'bot-feature-components-v2-settings' ||
    route.name === 'admin-bot-feature-components-v2-settings'
  )
    result.push('Components V2')
  return result
})
const featureRouteNames = new Set([
  'bot-feature-settings',
  'bot-feature-embed-settings',
  'bot-feature-components-v2-settings',
  'admin-bot-feature-settings',
  'admin-bot-feature-embed-settings',
  'admin-bot-feature-components-v2-settings',
])
const isFeatureRoute = computed(() => featureRouteNames.has(String(route.name)))
const shellSections = computed(() => [
  { id: 'bot-settings-overview', label: t('botSettings.botOverview') },
  { id: 'bot-settings-content', label: t('botSettings.settings') },
])

function goMain() {
  if (adminMode.value) {
    void router.push({ name: 'admin-bot-settings', params: { botId: botId.value } })
    return
  }
  void router.push({ name: 'bot-settings', params: { botId: botId.value } })
}
function goBack() {
  if (adminMode.value && !featureRouteNames.has(String(route.name))) {
    void router.push({ name: 'admin-bots' })
    return
  }
  if (route.name === 'bot-settings') {
    void router.push({ name: 'my-bot' })
    return
  }
  if (
    route.name === 'bot-feature-embed-settings' ||
    route.name === 'bot-feature-components-v2-settings' ||
    route.name === 'admin-bot-feature-embed-settings' ||
    route.name === 'admin-bot-feature-components-v2-settings'
  ) {
    void router.push({
      name: adminMode.value ? 'admin-bot-feature-settings' : 'bot-feature-settings',
      params: { botId: botId.value, licenseId: route.params.licenseId },
    })
    return
  }
  if (route.name === 'bot-feature-settings' || route.name === 'admin-bot-feature-settings') {
    void router.push({
      name: featureParentRoute.value,
      params: { botId: botId.value },
    })
    return
  }
  goMain()
}
function openTrail(index: number) {
  if (index === 0) {
    void router.push({
      name: featureParentRoute.value,
      params: { botId: botId.value },
    })
    return
  }
  if (index === 1 && route.params.licenseId) {
    void router.push({
      name: adminMode.value ? 'admin-bot-feature-settings' : 'bot-feature-settings',
      params: { botId: botId.value, licenseId: route.params.licenseId },
    })
  }
}
onMounted(() => void data.load())
</script>

<template>
  <main class="min-h-screen bg-bg-default pt-24 text-text-primary desktop:pt-28">
    <div class="page-container pb-5xl">
      <div id="bot-settings-overview">
        <BotSettingsShell
          :bot="bot"
          :loading="loading"
          :controlling="controlling"
          :control-action="controlAction"
          :trail="trail"
          @back="goBack"
          @main="goMain"
          @trail="openTrail"
          @control="runControl"
        />
      </div>
      <AppRequestError v-if="error" :message="error" @retry="data.load(true)" />
      <div id="bot-settings-content" class="bot-child-stage">
        <RouterView v-slot="{ Component }">
          <component
            :is="Component"
            :key="isFeatureRoute ? route.fullPath : `${adminMode ? 'admin' : 'user'}:${botId}`"
          />
        </RouterView>
      </div>
      <AppSectionIndicator
        v-if="!isFeatureRoute"
        :sections="shellSections"
        :aria-label="t('botSettings.sectionsLabel')"
      />
    </div>
  </main>
</template>

<style scoped>
.bot-child-stage {
  overflow-x: clip;
}
</style>
