<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { provide } from 'vue'
import { useFeatureSettings } from '../composables/useFeatureSettings'
import { featureEditorKey } from '../composables/featureEditorContext'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppModal from '@/shared/ui/dialogs/AppModal.vue'
import AppToast from '@/shared/ui/notifications/AppToast.vue'
import AppRequestError from '@/shared/ui/feedback/AppRequestError.vue'
import AppSectionIndicator from '@/shared/ui/navigation/AppSectionIndicator.vue'
import FeatureConfigFields from '@/features/bots/components/FeatureConfigFields.vue'
import FeaturePresentationSettings from '@/features/bots/components/FeaturePresentationSettings.vue'
import FeaturePresentationEditor from '@/features/bots/components/FeaturePresentationEditor.vue'
import { ArrowLeft, Save } from 'lucide-vue-next'

const { t } = useI18n()
const editor = useFeatureSettings()
provide(featureEditorKey, editor)
const {
  inBotSettingsFlow,
  goBack,
  presentationMode,
  license,
  configuration,
  saving,
  saveConfirmationOpen,
  error,
  loading,
  load,
  pageSections,
  confirmSave,
  toastOpen,
  toastMessage,
  toastVariant,
} = editor
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
          <h1 class="text-3xl font-bold tracking-tight desktop:text-5xl">
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
          :disabled="saving"
          @click="saveConfirmationOpen = true"
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

        <FeaturePresentationSettings v-if="!presentationMode" />

        <FeaturePresentationEditor v-else />
      </template>
      <AppSectionIndicator :sections="pageSections" aria-label="Feature settings sections" />
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
          <AppButton :disabled="saving" @click="confirmSave">
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
