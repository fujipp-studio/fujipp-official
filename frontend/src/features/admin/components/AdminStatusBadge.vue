<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(
  defineProps<{
    value: string
    label?: string
    appearance?: 'badge' | 'indicator'
  }>(),
  { label: undefined, appearance: 'badge' },
)
const tone = computed(() =>
  ['ACTIVE', 'RUNNING', 'READY'].includes(props.value)
    ? 'success'
    : ['SUSPENDED', 'BANNED', 'REVOKED', 'CRASHED'].includes(props.value)
      ? 'error'
      : ['GRACE', 'DRAFT'].includes(props.value)
        ? 'warning'
        : 'neutral',
)
</script>

<template>
  <span
    class="inline-flex h-fit w-fit shrink-0 items-center whitespace-nowrap text-xs font-semibold"
    :class="[
      appearance === 'badge' ? 'rounded-full border px-sm py-xxs' : 'gap-xs',
      {
        'border-success-border bg-success-bg text-success-text':
          appearance === 'badge' && tone === 'success',
        'border-error-border bg-error-bg text-error-text':
          appearance === 'badge' && tone === 'error',
        'border-warning-border bg-warning-bg text-warning-text':
          appearance === 'badge' && tone === 'warning',
        'border-border-subtle bg-bg-elevated text-text-secondary':
          appearance === 'badge' && tone === 'neutral',
        'text-success-text': appearance === 'indicator' && tone === 'success',
        'text-error-text': appearance === 'indicator' && tone === 'error',
        'text-warning-text': appearance === 'indicator' && tone === 'warning',
        'text-text-secondary': appearance === 'indicator' && tone === 'neutral',
      },
    ]"
    ><span
      v-if="appearance === 'indicator'"
      class="size-2 rounded-full bg-current"
      aria-hidden="true"
    />{{ label || value }}</span
  >
</template>
