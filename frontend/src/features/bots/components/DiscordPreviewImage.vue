<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ImageOff } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ src: string; alt?: string; compact?: boolean }>(), {
  alt: '',
  compact: false,
})
const { locale } = useI18n()
const failed = ref(false)
const attempt = ref(0)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)
const text = (en: string, th: string) => (locale.value === 'th' ? th : en)
const message = computed(() =>
  text('Image could not be loaded in this preview', 'โหลดรูปใน Preview ไม่สำเร็จ'),
)
const help = computed(() =>
  text(
    'Try loading it again, or check the image URL in your browser.',
    'ลองโหลดอีกครั้ง หรือตรวจสอบ URL รูปในเบราว์เซอร์',
  ),
)
function retry() {
  attempt.value++
  failed.value = false
}
function onError(event: Event) {
  if ((event.currentTarget as HTMLImageElement).getAttribute('src') === props.src)
    failed.value = true
}
</script>

<template>
  <img
    v-if="!failed"
    v-bind="$attrs"
    :key="src + '-' + attempt"
    :src="src"
    :alt="alt"
    @error="onError"
  />
  <div
    v-else
    v-bind="$attrs"
    class="discord-preview-image-error"
    :class="{ 'discord-preview-image-error--compact': compact }"
    :role="compact ? 'img' : 'group'"
    :aria-label="message + '. ' + help"
    :title="message + '. ' + help"
    data-preview-image-error
  >
    <ImageOff :size="20" aria-hidden="true" />
    <div v-if="!compact" class="min-w-0">
      <strong>{{ message }}</strong>
      <p>{{ help }}</p>
      <button type="button" class="discord-preview-image-retry" @click="retry">
        {{ text('Try again', 'ลองใหม่') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.discord-preview-image-error[data-preview-image-error] {
  display: flex;
  align-items: start;
  gap: var(--space-sm);
  min-width: 0;
  padding: var(--space-sm);
  border: 1px dashed var(--discord-border);
  border-radius: var(--corner-radius-md);
  background: var(--discord-surface-strong);
  color: var(--discord-muted);
  font-size: var(--font-size-body-small);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.discord-preview-image-error > svg {
  flex: none;
}
.discord-preview-image-error strong {
  color: var(--discord-text);
  font-weight: var(--typography-font-weight-medium);
}
.discord-preview-image-error p {
  margin-top: var(--space-xxs);
}
.discord-preview-image-error--compact[data-preview-image-error] {
  align-items: center;
  justify-content: center;
}
.discord-preview-image-retry {
  margin-top: var(--space-xs);
  padding: var(--space-xxs) var(--space-sm);
  border: 1px solid var(--discord-border);
  border-radius: var(--corner-radius-md);
  background: var(--discord-surface);
  color: var(--discord-text);
  font: inherit;
  cursor: pointer;
}
.discord-preview-image-retry:hover {
  background: var(--discord-surface-strong);
}
.discord-preview-image-retry:focus-visible {
  outline: 2px solid var(--discord-link);
  outline-offset: 2px;
}
</style>
