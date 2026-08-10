<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    disabled?: boolean
    label?: string
  }>(),
  {
    modelValue: false,
    disabled: false,
    label: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [value: boolean]
}>()

function toggle() {
  if (props.disabled) return
  const nextValue = !props.modelValue
  emit('change', nextValue)
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    class="app-toggle"
    :class="{ 'app-toggle--checked': modelValue, 'app-toggle--disabled': disabled }"
    @click="toggle"
  >
    <span class="app-toggle__track">
      <span class="app-toggle__thumb" />
    </span>
    <span v-if="label || $slots.default" class="app-toggle__label">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<style scoped>
.app-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs, 0.5rem);
  cursor: pointer;
  border: 0;
  background: transparent;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-md, 0.5rem);
  font: inherit;
  color: var(--semantic-color-text-text-primary, currentColor);
  user-select: none;
  transition: background-color 150ms ease;
}

.app-toggle:hover:not(:disabled) {
  background-color: var(--semantic-color-background-bg-surface-hover, rgba(255, 255, 255, 0.05));
}

.app-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.app-toggle__track {
  position: relative;
  display: inline-block;
  width: 2.75rem;
  height: 1.5rem;
  flex-shrink: 0;
  border-radius: 9999px;
  background-color: var(--semantic-color-border-border-default, #374151);
  transition: background-color 200ms ease;
}

.app-toggle--checked .app-toggle__track {
  background-color: var(--accent-primary, #10b981);
}

.app-toggle__thumb {
  position: absolute;
  top: 0.125rem;
  left: 0.125rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 9999px;
  background-color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.app-toggle--checked .app-toggle__thumb {
  transform: translateX(1.25rem);
}

.app-toggle__label {
  font-size: var(--font-size-label-medium, 0.875rem);
  font-weight: var(--typography-font-weight-medium, 500);
}
</style>
