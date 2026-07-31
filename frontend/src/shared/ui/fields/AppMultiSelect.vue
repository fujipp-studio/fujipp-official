<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'

import type { TextFieldState } from './types'

export interface MultiSelectOption {
  value: string
  label: string
  group?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string[]
  options?: readonly MultiSelectOption[]
  state?: TextFieldState
  label: string
  placeholder?: string
  supportText?: string
  disabled?: boolean
  required?: boolean
}>(), {
  modelValue: () => [],
  options: () => [],
  state: 'default',
  placeholder: 'Search and select…',
  supportText: '',
  disabled: false,
  required: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const root = ref<HTMLElement>()
const search = ref('')
const open = ref(false)
const generatedId = useId()
const fieldId = computed(() => `multi-select-${generatedId}`)
const listId = computed(() => `${fieldId.value}-options`)
const supportId = computed(() => `${fieldId.value}-support`)
const selectedOptions = computed(() =>
  props.modelValue.map((value) => props.options.find((option) => option.value === value) ?? { value, label: value }),
)
const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.options.filter((option) => {
    if (props.modelValue.includes(option.value)) return false
    if (!query) return true
    return `${option.label} ${option.value} ${option.group ?? ''}`.toLowerCase().includes(query)
  })
})

function select(option: MultiSelectOption) {
  if (option.disabled) return
  emit('update:modelValue', [...props.modelValue, option.value])
  search.value = ''
}

function remove(value: string) {
  emit('update:modelValue', props.modelValue.filter((selected) => selected !== value))
}

function move(index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= props.modelValue.length) return
  const next = [...props.modelValue]
  const current = next[index]
  const target = next[nextIndex]
  if (current === undefined || target === undefined) return
  next[index] = target
  next[nextIndex] = current
  emit('update:modelValue', next)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
  if (event.key === 'Backspace' && !search.value && props.modelValue.length) {
    remove(props.modelValue[props.modelValue.length - 1] ?? '')
  }
  if (event.key === 'Enter' && filteredOptions.value[0]) {
    event.preventDefault()
    select(filteredOptions.value[0])
  }
}

function handleDocumentClick(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', handleDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', handleDocumentClick))
</script>

<template>
  <div ref="root" class="multi-select" :class="[`multi-select--${state}`, { 'multi-select--open': open, 'multi-select--disabled': disabled }]">
    <label class="multi-select__label" :for="fieldId">
      {{ label }}<span v-if="required" class="multi-select__required">*</span>
    </label>
    <div class="multi-select__control" @click="open = !disabled">
      <div v-if="selectedOptions.length" class="multi-select__chips">
        <span v-for="(option, index) in selectedOptions" :key="option.value" class="multi-select__chip">
          <span>{{ option.label }}</span>
          <button type="button" :disabled="index === 0" :aria-label="`Move ${option.label} earlier`" @click.stop="move(index, -1)">‹</button>
          <button type="button" :disabled="index === selectedOptions.length - 1" :aria-label="`Move ${option.label} later`" @click.stop="move(index, 1)">›</button>
          <button type="button" :aria-label="`Remove ${option.label}`" @click.stop="remove(option.value)">×</button>
        </span>
      </div>
      <input
        :id="fieldId"
        v-model="search"
        class="multi-select__input"
        type="search"
        :placeholder="selectedOptions.length ? 'Add another…' : placeholder"
        :disabled="disabled"
        role="combobox"
        autocomplete="off"
        :aria-expanded="open"
        :aria-controls="listId"
        :aria-invalid="state === 'error'"
        :aria-describedby="supportText ? supportId : undefined"
        @focus="open = true"
        @keydown="handleKeydown"
      />
      <div v-if="open" :id="listId" class="multi-select__options" role="listbox" :aria-label="label">
        <button v-for="option in filteredOptions" :key="option.value" type="button" role="option" :disabled="option.disabled" @click.stop="select(option)">
          <span>
            <strong>{{ option.label }}</strong>
            <small>{{ option.group ? `${option.group} · ` : '' }}{{ option.value }}</small>
          </span>
        </button>
        <p v-if="!filteredOptions.length">No matching options</p>
      </div>
    </div>
    <p v-if="supportText" :id="supportId" class="multi-select__support">{{ supportText }}</p>
  </div>
</template>

<style scoped>
.multi-select { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: var(--space-xs); color: var(--semantic-color-text-text-primary); font-family: var(--font-family-sans); font-size: var(--font-size-label-medium); }
.multi-select__label { line-height: var(--line-height-label); font-weight: var(--typography-font-weight-medium); }
.multi-select__required { color: var(--semantic-color-error-error-text); }
.multi-select__control { position: relative; display: flex; min-height: 3rem; flex-direction: column; justify-content: center; gap: var(--space-xs); border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--corner-radius-md); padding: var(--space-xs) var(--space-md); background: var(--semantic-color-background-bg-default); transition: border-color 160ms ease, box-shadow 160ms ease; }
.multi-select__control:focus-within, .multi-select--open .multi-select__control { border-color: var(--semantic-color-action-borders-border-focus); box-shadow: 0 0 0 1px var(--semantic-color-action-borders-border-focus); }
.multi-select--error .multi-select__control { border-color: var(--semantic-color-error-error-text); }
.multi-select__chips { display: flex; flex-wrap: wrap; gap: var(--space-xs); }
.multi-select__chip { display: inline-flex; align-items: center; gap: var(--space-xxs); padding: var(--space-xxs) var(--space-xs); border-radius: var(--corner-radius-sm); background: var(--semantic-color-background-bg-surface-selected); font-size: var(--font-size-label-small); }
.multi-select__chip button { display: grid; width: 1.25rem; height: 1.25rem; place-items: center; border: 0; border-radius: var(--corner-radius-full); padding: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
.multi-select__chip button:hover:not(:disabled) { background: var(--semantic-color-background-bg-surface-hover); }
.multi-select__chip button:disabled { cursor: default; opacity: 0.25; }
.multi-select__input { width: 100%; min-width: 0; border: 0; outline: 0; padding: 0; background: transparent; color: inherit; font: inherit; line-height: var(--line-height-body); }
.multi-select__input::placeholder { color: var(--semantic-color-text-text-muted); }
.multi-select__input::-webkit-search-cancel-button { display: none; }
.multi-select__options { position: absolute; z-index: var(--z-popover); top: calc(100% + var(--space-xxs)); right: -1px; left: -1px; display: grid; max-height: 18rem; overflow-y: auto; border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--corner-radius-md); padding: var(--space-xxs); background: var(--semantic-color-background-bg-elevated); box-shadow: var(--effect-shadow-lg); }
.multi-select__options button { display: flex; width: 100%; min-height: 3rem; align-items: center; border: 0; border-radius: var(--corner-radius-sm); padding: var(--space-xs) var(--space-sm); background: transparent; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.multi-select__options button:hover, .multi-select__options button:focus-visible { outline: 0; background: var(--semantic-color-background-bg-surface-hover); }
.multi-select__options button > span { display: grid; gap: var(--space-xxs); }
.multi-select__options small { color: var(--semantic-color-text-text-muted); }
.multi-select__options > p { margin: 0; padding: var(--space-md); color: var(--semantic-color-text-text-muted); }
.multi-select__support { margin: 0; color: var(--semantic-color-text-text-muted); font-size: var(--font-size-label-small); line-height: var(--line-height-label); font-weight: var(--typography-font-weight-medium); }
.multi-select--disabled { color: var(--semantic-color-text-text-disabled); }
.multi-select--disabled .multi-select__control { border-color: var(--semantic-color-border-border-disabled); background: var(--semantic-color-action-backgrounds-bg-disabled); }
@media (prefers-reduced-motion: reduce) { .multi-select__control { transition: none; } }
</style>
