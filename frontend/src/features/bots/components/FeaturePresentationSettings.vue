<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { t } = useI18n()
const {
  configuration,
  openPresentation,
  presentationSlotLabel,
  slotMode,
  presentationModeOptions,
  availablePresentationModes,
  canSwitchPresentationMode,
  setPresentationMode,
} = useFeatureEditor()
</script>
<template>
  <section v-if="configuration" id="feature-presentations" class="mt-2xl">
    <div class="mb-md">
      <h2 class="text-2xl font-semibold">{{ t('botSettings.messageDesign') }}</h2>
      <p class="text-sm text-text-secondary">
        {{ t('botSettings.openADesignerWithoutChangingTheFormat') }}
      </p>
    </div>
    <div v-if="configuration.presentations.length" class="space-y-md">
      <div class="presentation-menu">
        <button
          v-for="mode in availablePresentationModes"
          :key="mode.value"
          class="presentation-card"
          type="button"
          @click="openPresentation(mode.value as 'EMBED' | 'COMPONENTS_V2')"
        >
          <span class="text-2xl font-bold">{{
            mode.value === 'EMBED'
              ? t('botSettings.designEmbed')
              : t('botSettings.designComponentsV2')
          }}</span>
          <span>{{
            mode.value === 'EMBED'
              ? t('botSettings.openTheEmbedDesigner')
              : t('botSettings.openTheComponentsV2Designer')
          }}</span>
        </button>
      </div>
      <div class="presentation-slot-list">
        <article
          v-for="slot in configuration.presentations"
          :key="slot.slotId"
          class="presentation-slot-row"
        >
          <div class="min-w-0">
            <strong class="block truncate">{{ presentationSlotLabel(slot) }}</strong>
            <span class="font-mono text-xs text-text-muted">{{ slot.key }}</span>
          </div>
          <AppTextField
            v-if="canSwitchPresentationMode"
            :model-value="slotMode(slot.key)"
            variant="dropdown"
            label=""
            :options="presentationModeOptions"
            @update:model-value="(mode) => setPresentationMode(slot.key, mode)"
          />
          <span v-else class="presentation-mode-badge">{{ slotMode(slot.key) }}</span>
          <AppButton
            class="presentation-slot-edit"
            variant="secondary"
            @click="openPresentation(slotMode(slot.key))"
          >
            {{ t('botSettings.edit') }}
          </AppButton>
        </article>
      </div>
    </div>
    <div
      v-else
      class="rounded-lg border border-dashed border-border-default p-xl text-center text-text-muted"
    >
      {{ t('botSettings.thisFeatureHasNoEmbedOrComponents') }}
    </div>
  </section>
</template>
