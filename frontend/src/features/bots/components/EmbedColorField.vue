<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useFeatureEditor } from '../composables/featureEditorContext'
import type { FeatureConfiguration } from '../api'

const { t } = useI18n()
defineProps<{ messageSlot: FeatureConfiguration['presentations'][number] }>()
const { embedColor, updateEmbedColor, text } = useFeatureEditor()
</script>
<template>
  <div>
    <span class="text-sm font-medium">{{ t('botSettings.embedColor') }}</span>
    <div class="mt-xs grid grid-cols-[3.5rem_1fr] gap-xs">
      <input
        :value="embedColor(messageSlot.key) || '#d5d8dc'"
        type="color"
        class="field-control h-11 cursor-pointer p-1"
        :aria-label="t('botSettings.chooseEmbedColor')"
        @input="updateEmbedColor(messageSlot.key, ($event.target as HTMLInputElement).value)"
      />
      <input
        :value="embedColor(messageSlot.key)"
        class="field-control h-11 font-mono uppercase"
        :aria-label="`${t('botSettings.embedColor')} (HEX)`"
        maxlength="7"
        :placeholder="text('Not set', 'ไม่ได้กำหนด')"
        @change="updateEmbedColor(messageSlot.key, ($event.target as HTMLInputElement).value)"
      />
    </div>
    <p class="mt-xs text-xs text-text-secondary">
      {{
        text(
          'Leave HEX blank to use Discord’s default border.',
          'เว้น HEX ว่างเพื่อใช้สีขอบเริ่มต้นของ Discord',
        )
      }}
    </p>
  </div>
</template>
