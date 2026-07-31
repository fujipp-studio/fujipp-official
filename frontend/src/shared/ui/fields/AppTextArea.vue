<script setup lang="ts">
import { computed, useId } from 'vue'

import type { TextFieldState } from './types'

withDefaults(defineProps<{
  modelValue?: string
  state?: TextFieldState
  label: string
  placeholder?: string
  supportText?: string
  rows?: number
  maxlength?: number
  required?: boolean
  disabled?: boolean
}>(), {
  modelValue: '',
  state: 'default',
  placeholder: '',
  supportText: '',
  rows: 4,
  maxlength: undefined,
  required: false,
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const generatedId = useId()
const fieldId = computed(() => `text-area-${generatedId}`)
const supportId = computed(() => `${fieldId.value}-support`)
</script>

<template>
  <div class="text-area" :class="[`text-area--${state}`, { 'text-area--disabled': disabled }]">
    <label class="text-area__label" :for="fieldId">
      {{ label }}<span v-if="required" class="text-area__required">*</span>
    </label>
    <div class="text-area__control">
      <textarea
        :id="fieldId"
        class="text-area__input"
        :value="modelValue"
        :placeholder="placeholder"
        :rows="rows"
        :maxlength="maxlength"
        :required="required"
        :disabled="disabled"
        :aria-invalid="state === 'error'"
        :aria-describedby="supportText ? supportId : undefined"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
    <p v-if="supportText" :id="supportId" class="text-area__support">{{ supportText }}</p>
  </div>
</template>

<style scoped>
.text-area { display: flex; width: 100%; flex-direction: column; align-items: stretch; gap: var(--space-xs); color: var(--semantic-color-text-text-primary); font-family: var(--font-family-sans); font-size: var(--font-size-label-medium); }
.text-area__label { line-height: var(--line-height-label); font-weight: var(--typography-font-weight-medium); }
.text-area__required { color: var(--semantic-color-error-error-text); }
.text-area__control { box-sizing: border-box; display: flex; width: 100%; min-height: 7rem; overflow: hidden; border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--corner-radius-md); padding: var(--space-sm) var(--space-md); background: var(--semantic-color-background-bg-default); color: var(--semantic-color-text-text-primary); font-size: var(--font-size-body-medium); transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease; }
.text-area__control:focus-within, .text-area--focused .text-area__control { border-color: var(--semantic-color-action-borders-border-focus); box-shadow: 0 0 0 1px var(--semantic-color-action-borders-border-focus); }
.text-area--error .text-area__control { border-color: var(--semantic-color-error-error-text); box-shadow: 0 0 0 0.5px var(--semantic-color-error-error-text); }
.text-area__input { width: 100%; min-width: 0; min-height: 100%; resize: vertical; border: 0; outline: 0; padding: 0; background: transparent; color: inherit; font: inherit; line-height: var(--line-height-body); }
.text-area__input::placeholder { color: var(--semantic-color-text-text-muted); opacity: 1; }
.text-area__support { margin: 0; color: var(--semantic-color-text-text-muted); font-size: var(--font-size-label-small); line-height: var(--line-height-label); font-weight: var(--typography-font-weight-medium); }
.text-area--error .text-area__support { color: var(--semantic-color-error-error-text); }
.text-area--disabled { color: var(--semantic-color-text-text-disabled); }
.text-area--disabled .text-area__control { border-color: var(--semantic-color-border-border-disabled); background: var(--semantic-color-action-backgrounds-bg-disabled); }
.text-area--disabled .text-area__input { cursor: not-allowed; color: var(--semantic-color-text-text-disabled); }
@media (prefers-reduced-motion: reduce) { .text-area__control { transition: none; } }
</style>
