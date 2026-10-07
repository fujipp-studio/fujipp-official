<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, defineAsyncComponent, provide, watch } from 'vue'
import { useFeatureSettings } from '../composables/useFeatureSettings'
import { featureEditorKey } from '../composables/featureEditorContext'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppModal from '@/shared/ui/dialogs/AppModal.vue'
import AppToast from '@/shared/ui/notifications/AppToast.vue'
import AppRequestError from '@/shared/ui/feedback/AppRequestError.vue'
import AppSectionIndicator from '@/shared/ui/navigation/AppSectionIndicator.vue'
import FeaturePresentationSettings from '@/features/bots/components/FeaturePresentationSettings.vue'
import { ArrowLeft, Save } from 'lucide-vue-next'

const loadConfigFields = () => import('@/features/bots/components/FeatureConfigFields.vue')
const loadPresentationEditor = () =>
  import('@/features/bots/components/FeaturePresentationEditor.vue')
const FeatureConfigFields = defineAsyncComponent(loadConfigFields)
const FeaturePresentationEditor = defineAsyncComponent(loadPresentationEditor)
const { t } = useI18n()
const editor = useFeatureSettings()
provide(featureEditorKey, editor)
const {
  inBotSettingsFlow,
  goBack,
  presentationMode,
  license,
  text,
  configuration,
  saving,
  canSave,
  requestSave,
  saveConfirmationOpen,
  error,
  loading,
  load,
  pageSections,
  confirmSave,
  toastOpen,
  toastMessage,
  toastVariant,
  isRuntimeAlertFeature,
} = editor
const isMemberSpending = computed(() => license.value?.featureCode === 'member-spending')
const isBotPresence = computed(() => license.value?.featureCode === 'bot-presence')
const isBotPermissions = computed(() => license.value?.featureCode === 'bot-permissions')
const isReviewCredit = computed(() => license.value?.featureCode === 'review-credit')
const isVoiceKeeper = computed(() => license.value?.featureCode === 'voice-keeper')
const isWalletTopup = computed(() => license.value?.featureCode === 'wallet-topup')
const isMessageTriggers = computed(() => license.value?.featureCode === 'channel-message-triggers')
const isPaymentTrigger = computed(() => license.value?.featureCode === 'payment-trigger')
const hasCustomConfig = computed(
  () =>
    isMemberSpending.value ||
    isBotPresence.value ||
    isRuntimeAlertFeature.value ||
    isBotPermissions.value ||
    isReviewCredit.value ||
    isVoiceKeeper.value ||
    isWalletTopup.value ||
    editor.isRobloxPayoutFeature.value ||
    isMessageTriggers.value ||
    isPaymentTrigger.value ||
    editor.isPriceReaderFeature.value,
)
watch(
  presentationMode,
  (mode) => {
    // Fetch the selected editor alongside its API data, avoiding a second waterfall.
    void (mode ? loadPresentationEditor() : loadConfigFields()).catch(() => {
      // The async component retries and reports a load error when it is rendered.
    })
  },
  { immediate: true },
)
</script>
<template>
  <section
    class="feature-settings"
    :class="
      inBotSettingsFlow
        ? 'text-text-primary'
        : 'min-h-screen bg-bg-default pt-24 text-text-primary desktop:pt-28'
    "
  >
    <div :class="inBotSettingsFlow ? '' : 'page-container pb-5xl'">
      <button
        v-if="!inBotSettingsFlow"
        class="mb-md inline-flex items-center gap-xs text-sm text-text-secondary hover:text-text-primary"
        @click="goBack"
      >
        <ArrowLeft :size="17" />
        {{
          presentationMode
            ? t('botSettings.backToFeatureSettings')
            : inBotSettingsFlow
              ? t('botSettings.backToPackageSettings')
              : t('botSettings.backToMyBot')
        }}
      </button>
      <header class="flex flex-col gap-md tablet:flex-row tablet:items-end tablet:justify-between">
        <div>
          <h1
            class="text-3xl font-bold tracking-tight"
            :class="
              presentationMode === 'EMBED'
                ? 'desktop:text-3xl'
                : hasCustomConfig && !presentationMode
                  ? 'desktop:text-4xl'
                  : 'desktop:text-5xl'
            "
          >
            {{
              presentationMode === 'EMBED'
                ? `Embed · ${license?.featureName ?? 'Feature'}`
                : presentationMode === 'COMPONENTS_V2'
                  ? `Components V2 · ${license?.featureName ?? 'Feature'}`
                  : (license?.featureName ?? t('botSettings.featureSettings'))
            }}
          </h1>
          <p class="mt-sm text-text-secondary">
            {{
              presentationMode
                ? t('botSettings.editMessageLayoutAndPreviewBeforeSaving')
                : hasCustomConfig
                  ? text('Feature settings', 'ตั้งค่าฟีเจอร์')
                  : t('botSettings.configSecretsAndDisplayFormatsForYour')
            }}
            · Version
            {{ configuration?.revision ?? '—' }}
          </p>
        </div>
        <AppButton
          v-if="configuration"
          class="tablet:!w-auto"
          variant="secondary"
          :disabled="!canSave"
          @click="requestSave"
        >
          <Save :size="18" />
          {{ saving ? t('botSettings.saving') : t('botSettings.saveAll') }}
        </AppButton>
      </header>

      <AppRequestError v-if="error" :message="error" :busy="loading" @retry="load" />
      <div v-if="loading" class="mt-xl grid gap-md desktop:grid-cols-2">
        <div v-for="item in 4" :key="item" class="h-48 animate-pulse rounded-lg bg-bg-surface" />
      </div>

      <template v-else-if="configuration">
        <FeatureConfigFields v-if="!presentationMode" />

        <FeaturePresentationSettings
          v-if="!presentationMode && (!hasCustomConfig || configuration.presentations.length)"
        />

        <FeaturePresentationEditor v-if="presentationMode" />
      </template>
      <AppSectionIndicator
        v-if="!hasCustomConfig || presentationMode || configuration?.presentations.length"
        :sections="pageSections"
        aria-label="Feature settings sections"
      />
      <AppModal
        v-model:open="saveConfirmationOpen"
        size="sm"
        :disabled="saving"
        :title="t('botSettings.confirmSave')"
        :subtitle="t('botSettings.theNewConfigurationWillBeUsedBy')"
      >
        <p class="text-sm text-text-secondary">
          {{ t('botSettings.saveAllConfigurationAndMessagePresentationChanges') }}
        </p>
        <template #actions>
          <AppButton variant="secondary" :disabled="saving" @click="saveConfirmationOpen = false">
            {{ t('botSettings.cancel') }}
          </AppButton>
          <AppButton :disabled="!canSave" @click="confirmSave">
            <Save :size="18" />
            {{ saving ? t('botSettings.saving') : t('botSettings.confirmSave') }}
          </AppButton>
        </template>
      </AppModal>
      <AppToast v-model:open="toastOpen" :message="toastMessage" :variant="toastVariant" />
    </div>
  </section>
</template>
<style src="../styles/feature-editor.css"></style>
