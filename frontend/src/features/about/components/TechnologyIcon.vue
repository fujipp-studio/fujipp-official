<script setup lang="ts">
import type { SimpleIcon } from 'simple-icons'

defineProps<{
  icon: SimpleIcon
}>()
</script>

<template>
  <svg
    class="technology-icon"
    viewBox="0 0 24 24"
    role="img"
    :aria-label="icon.title"
  >
    <path :d="icon.path" :fill="`#${icon.hex}`" />
  </svg>
</template>

<style scoped>
.technology-icon {
  width: var(--icon-size-24);
  height: var(--icon-size-24);
  flex-shrink: 0;
}
</style>
