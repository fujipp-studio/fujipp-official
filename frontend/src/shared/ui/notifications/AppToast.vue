<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

type ToastVariant = 'info' | 'success' | 'error'

const props = withDefaults(
  defineProps<{
    open: boolean
    message: string
    variant?: ToastVariant
    duration?: number
  }>(),
  {
    variant: 'info',
    duration: 3200,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

let dismissTimer: ReturnType<typeof setTimeout> | undefined

function clearDismissTimer() {
  if (dismissTimer) clearTimeout(dismissTimer)
  dismissTimer = undefined
}

function startDismissTimer() {
  clearDismissTimer()
  if (!props.open || props.duration <= 0) return
  dismissTimer = setTimeout(() => emit('update:open', false), props.duration)
}

watch(() => [props.open, props.message, props.duration], startDismissTimer, { immediate: true })
onBeforeUnmount(clearDismissTimer)
</script>

<template>
  <Teleport to="body">
    <Transition name="app-toast">
      <div
        v-if="open"
        class="app-toast"
        :class="`app-toast--${variant}`"
        :role="variant === 'error' ? 'alert' : 'status'"
        :aria-live="variant === 'error' ? 'assertive' : 'polite'"
        @mouseenter="clearDismissTimer"
        @mouseleave="startDismissTimer"
      >
        <span class="app-toast__accent" aria-hidden="true" />
        <p>{{ message }}</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-toast {
  position: fixed;
  z-index: var(--z-toast);
  right: var(--space-md);
  bottom: var(--space-md);
  display: flex;
  width: min(22rem, calc(100vw - 2 * var(--space-md)));
  min-height: 3rem;
  align-items: center;
  gap: var(--space-sm);
  overflow: hidden;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid color-mix(in srgb, var(--semantic-color-border-border-default) 70%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--semantic-color-background-bg-glass) 92%, transparent);
  box-shadow: var(--effect-shadow-lg), var(--effect-glass-highlight);
  color: var(--semantic-color-text-text-primary);
  backdrop-filter: blur(1rem) saturate(1.25);
}

.app-toast__accent {
  width: 0.25rem;
  height: 1.75rem;
  flex: none;
  border-radius: var(--radius-full);
  background: var(--semantic-color-text-text-primary);
}

.app-toast--success .app-toast__accent {
  background: var(--semantic-color-success-success-text);
}

.app-toast--error .app-toast__accent {
  background: var(--semantic-color-error-error-text);
}

.app-toast p {
  margin: 0;
  font-size: var(--font-size-body-small);
  font-weight: var(--typography-font-weight-medium);
  line-height: var(--line-height-body);
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translateY(0.75rem) scale(0.98);
}

@media (max-width: 47.99rem) {
  .app-toast {
    right: var(--space-sm);
    bottom: var(--space-sm);
    width: calc(100vw - 2 * var(--space-sm));
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-toast-enter-active,
  .app-toast-leave-active {
    transition: none;
  }
}
</style>
