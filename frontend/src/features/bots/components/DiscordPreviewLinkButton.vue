<script setup lang="ts">
import { ExternalLink } from 'lucide-vue-next'

defineProps<{ href?: string; disabled?: boolean }>()
</script>

<template>
  <component
    :is="disabled ? 'button' : 'a'"
    class="preview-link-button"
    :href="disabled ? undefined : href"
    :type="disabled ? 'button' : undefined"
    :disabled="disabled || undefined"
    :target="disabled ? undefined : '_blank'"
    :rel="disabled ? undefined : 'noreferrer'"
  >
    <span v-if="$slots.emoji" class="preview-link-emoji"><slot name="emoji" /></span>
    <span class="preview-link-label"><slot /></span>
    <ExternalLink class="preview-link-icon" :size="16" aria-hidden="true" />
  </component>
</template>

<style scoped>
.preview-link-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xxs);
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  min-height: 32px;
  padding: var(--space-xxs) var(--space-sm);
  border: 1px solid var(--discord-border);
  border-radius: var(--corner-radius-md);
  background: var(--discord-surface);
  color: var(--discord-text);
  font-family: inherit;
  font-size: var(--discord-embed-size);
  font-weight: var(--typography-font-weight-medium);
  line-height: 18px;
  text-decoration: none;
  cursor: pointer;
}
.preview-link-button:hover:not(:disabled) {
  background: var(--discord-surface-strong);
}
.preview-link-button:focus-visible {
  outline: 2px solid var(--discord-link);
  outline-offset: 2px;
}
.preview-link-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.preview-link-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-link-emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  font-size: 20px;
  line-height: 20px;
}
.preview-link-emoji :deep(.discord-custom-emoji) {
  display: block;
  width: 20px;
  height: 20px;
  margin: 0;
  object-fit: contain;
}
.preview-link-icon {
  flex: 0 0 auto;
}
</style>
