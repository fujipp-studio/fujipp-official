<script setup lang="ts">
import { computed } from 'vue'
import DiscordPresentationPreview from './DiscordPresentationPreview.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import { priceReaderPresentationPreview } from '../models/price-reader-presentation-preview'
const props = defineProps<{ samples: Record<string, string>; slotKey?: string }>()
const { presentations, previewBot } = useFeatureEditor()
const definition = computed(() => {
  const key = props.slotKey ?? (props.samples.success_count === '0' ? 'error' : 'result')
  const raw = presentations.value[key] ?? {
    mode: 'COMPONENTS_V2',
    title: '',
    description: '{{results_text}}',
  }
  return priceReaderPresentationPreview(raw, props.samples)
})
</script>
<template>
  <DiscordPresentationPreview
    :definition="definition"
    :variables="Object.keys(samples)"
    :sample-values="samples"
    :bot-name="previewBot?.discordUsername || previewBot?.name"
    :bot-avatar-url="previewBot?.discordAvatarUrl"
    compact
  />
</template>
