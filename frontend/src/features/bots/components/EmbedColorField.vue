<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useFeatureEditor } from '../composables/featureEditorContext'
import type { FeatureConfiguration } from '../api'

const { t } = useI18n()
defineProps<{ messageSlot: FeatureConfiguration['presentations'][number] }>()
const { embedColor, updateEmbedColor } = useFeatureEditor()
</script>
<template>
  <div class="tablet:col-span-2">
    <span class="text-sm font-medium">{{ t('botSettings.embedColor') }}</span>
    <div class="mt-xs grid grid-cols-[3.5rem_1fr] gap-xs">
      <input
        :value="embedColor(messageSlot.key)"
        type="color"
        class="field-control h-11 cursor-pointer p-1"
        :aria-label="t('botSettings.chooseEmbedColor')"
        @input="updateEmbedColor(messageSlot.key, ($event.target as HTMLInputElement).value)"
      />
      <input
        :value="embedColor(messageSlot.key)"
        class="field-control h-11 font-mono uppercase"
        maxlength="7"
        placeholder="#5865F2"
        @change="updateEmbedColor(messageSlot.key, ($event.target as HTMLInputElement).value)"
      />
    </div>
    <p class="mt-xs text-xs text-text-secondary">
      {{ t('botSettings.chooseAColorOrEnterASix') }}
    </p>
  </div>
</template>
