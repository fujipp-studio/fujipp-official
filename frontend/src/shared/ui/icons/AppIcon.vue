<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { getIconColorMode, type IconSource } from '../../../config'
import { loadLocalIcon } from './iconLoader'

const props = defineProps<{
  source: IconSource
}>()

const svgMarkup = ref('')

async function updateIcon() {
  const source = props.source
  svgMarkup.value = ''
  if (getIconColorMode(source) === 'original') return
  try {
    const markup = await loadLocalIcon(source)
    if (props.source === source) svgMarkup.value = markup
  } catch {
    if (props.source === source) svgMarkup.value = ''
  }
}

watch(() => props.source, updateIcon)
onMounted(updateIcon)
</script>

<template>
  <span class="app-icon" aria-hidden="true">
    <img v-if="getIconColorMode(source) === 'original'" :src="source" alt="" />
    <!-- SVG sources are restricted to the application's typed local icon registry. -->
    <span v-else-if="svgMarkup" class="app-icon__svg" v-html="svgMarkup" />
  </span>
</template>

<style scoped>
.app-icon,
.app-icon__svg,
.app-icon :deep(svg),
.app-icon img {
  display: block;
  width: 100%;
  height: 100%;
}

.app-icon {
  flex: none;
  color: inherit;
}

.app-icon :deep(svg),
.app-icon img {
  object-fit: contain;
}
</style>
