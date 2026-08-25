<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'

import { icons } from '../../../config'
import AppIcon from '../icons/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    open?: boolean
    title?: string
    subtitle?: string
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
  }>(),
  {
    open: false,
    title: '',
    subtitle: '',
    size: 'md',
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
}>()

const dialogElement = ref<HTMLDialogElement>()
const generatedId = useId()
const titleId = `app-modal-title-${generatedId}`
const subtitleId = `app-modal-subtitle-${generatedId}`

watch(
  () => props.open,
  async (isOpen) => {
    await nextTick()
    if (isOpen && dialogElement.value && !dialogElement.value.open) {
      dialogElement.value.showModal()
      dialogElement.value.focus({ preventScroll: true })
    } else if (!isOpen && dialogElement.value?.open) {
      dialogElement.value.close()
    }
  },
  { immediate: true },
)

function handleClose() {
  if (props.disabled) return
  emit('update:open', false)
  emit('close')
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === dialogElement.value) {
    handleClose()
  }
}
</script>

<template>
  <dialog
    v-if="open"
    ref="dialogElement"
    class="app-modal"
    tabindex="-1"
    :class="`app-modal--${size}`"
    :aria-labelledby="title ? titleId : undefined"
    :aria-describedby="subtitle ? subtitleId : undefined"
    @cancel.prevent="handleClose"
    @close="handleClose"
    @click="handleBackdropClick"
  >
    <div class="app-modal__content">
      <header class="app-modal__header">
        <slot name="header">
          <div>
            <h2 v-if="title" :id="titleId" class="app-modal__title">{{ title }}</h2>
            <p v-if="subtitle" :id="subtitleId" class="app-modal__subtitle">{{ subtitle }}</p>
          </div>
        </slot>
        <button
          type="button"
          class="app-modal__close"
          aria-label="Close dialog"
          :disabled="disabled"
          @click="handleClose"
        >
          <AppIcon class="app-modal__close-icon" :source="icons.base.close" />
        </button>
      </header>

      <div class="app-modal__body">
        <slot />
      </div>

      <footer v-if="$slots.actions || $slots.footer" class="app-modal__actions">
        <slot name="actions">
          <slot name="footer" />
        </slot>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.app-modal {
  margin: auto;
  padding: 0;
  max-height: min(88dvh, 52rem);
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-default, #374151);
  border-radius: var(--corner-radius-xl, 1rem);
  background: var(--semantic-color-background-bg-elevated, #111827);
  color: var(--semantic-color-text-text-primary, #ffffff);
  box-shadow: var(--effect-shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.5));
}

.app-modal:focus {
  outline: none;
}

.app-modal--sm {
  width: min(calc(100% - (var(--space-md) * 2)), 28rem);
}

.app-modal--md {
  width: min(calc(100% - (var(--space-md) * 2)), 34rem);
}

.app-modal--lg {
  width: min(calc(100% - (var(--space-md) * 2)), 44rem);
}

.app-modal::backdrop {
  background: var(--semantic-color-background-bg-overlay, rgba(0, 0, 0, 0.6));
  backdrop-filter: blur(4px);
}

.app-modal__content {
  display: flex;
  max-height: min(88dvh, 52rem);
  flex-direction: column;
}

.app-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md, 1rem);
  padding: var(--space-xl, 1.5rem) var(--space-xl, 1.5rem) var(--space-md, 1rem);
}

.app-modal__subtitle {
  max-width: 36rem;
  margin-top: var(--space-xs, 0.75rem);
  font-size: var(--font-size-label-small, 0.75rem);
  line-height: var(--line-height-body, 1.5);
  color: var(--semantic-color-text-text-secondary, #9ca3af);
}

.app-modal__title {
  font-size: var(--font-size-heading-medium, 1.5rem);
  font-weight: var(--typography-font-weight-extrabold, 800);
  color: var(--semantic-color-text-text-primary, #ffffff);
}

.app-modal__close {
  display: grid;
  width: var(--icon-size-32);
  height: var(--icon-size-32);
  flex: 0 0 var(--icon-size-32);
  place-items: center;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--semantic-color-text-text-primary, #ffffff);
  cursor: pointer;
  transition: opacity 150ms ease;
}

.app-modal__close-icon {
  width: var(--icon-size-16);
  height: var(--icon-size-16);
}

.app-modal__close:hover:not(:disabled) {
  opacity: 0.68;
}

.app-modal__close:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.app-modal__close:focus-visible {
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 2px;
}

.app-modal__body {
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--space-xl, 1.5rem) var(--space-xl, 1.5rem);
  font-size: var(--font-size-body-medium, 0.9375rem);
  line-height: var(--line-height-body, 1.5);
  color: var(--semantic-color-text-text-secondary, #d1d5db);
  scrollbar-width: none;
}

.app-modal__body::-webkit-scrollbar {
  display: none;
}

.app-modal__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xs, 0.75rem);
  padding: var(--space-md, 1rem) var(--space-xl, 1.5rem) var(--space-xl, 1.5rem);
  border-top: 1px solid var(--semantic-color-border-border-subtle, #1f2937);
}

@media (max-width: 639px) {
  .app-modal {
    width: calc(100% - (var(--space-md) * 2));
    max-height: calc(100dvh - (var(--space-md) * 2));
  }

  .app-modal__content {
    max-height: calc(100dvh - (var(--space-md) * 2));
  }

  .app-modal__header,
  .app-modal__body,
  .app-modal__actions {
    padding-right: var(--space-md, 1rem);
    padding-left: var(--space-md, 1rem);
  }

  .app-modal__actions {
    flex-direction: column-reverse;
  }

  .app-modal__actions :deep(.app-button) {
    width: 100%;
  }
}

.app-modal__actions :deep(.app-button) {
  width: auto;
  min-width: 6.5rem;
  flex-shrink: 0;
}
</style>
