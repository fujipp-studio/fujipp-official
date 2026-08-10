<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

import { icons } from '../../../config'
import AppIcon from '../icons/AppIcon.vue'
import SecretCharacter from './SecretCharacter.vue'
import type { TextFieldOption, TextFieldState, TextFieldVariant } from './types'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    variant?: TextFieldVariant
    state?: TextFieldState
    label?: string
    placeholder?: string
    supportText?: string
    unit?: string
    options?: readonly TextFieldOption[]
    name?: string
    autocomplete?: string
    inputType?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'date'
    maxlength?: number
    pattern?: string
    disabled?: boolean
    required?: boolean
    searchable?: boolean
    searchPlaceholder?: string
    emptyText?: string
  }>(),
  {
    modelValue: '',
    variant: 'text',
    state: 'default',
    label: 'Title',
    placeholder: 'Placeholder',
    supportText: '',
    unit: '',
    options: () => [],
    name: undefined,
    autocomplete: undefined,
    inputType: 'text',
    maxlength: undefined,
    pattern: undefined,
    disabled: false,
    required: false,
    searchable: false,
    searchPlaceholder: 'Search…',
    emptyText: 'No matching options',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const fieldElement = ref<HTMLElement>()
const dropdownElement = ref<HTMLElement>()
const dropdownSearchElement = ref<HTMLInputElement>()
const isDropdownOpen = ref(false)
const isInsideDialog = ref(false)
const dropdownSearch = ref('')
const isSecretVisible = ref(false)
const isSecretFocused = ref(false)
const highlightedOptionIndex = ref(-1)
const dropdownStyle = ref<Record<string, string>>({})
const generatedId = useId()
const fieldId = computed(() => `text-field-${generatedId}`)
const supportId = computed(() => `${fieldId.value}-support`)
const dropdownId = computed(() => `${fieldId.value}-options`)
const isEmpty = computed(() => props.modelValue.length === 0)
const selectedOption = computed(() =>
  props.options.find((option) => option.value === props.modelValue),
)
const displayedOptions = computed(() => {
  const query = dropdownSearch.value.trim().toLowerCase()
  if (!props.searchable || !query) return props.options
  return props.options.filter((option) =>
    `${option.label} ${option.value}`.toLowerCase().includes(query),
  )
})
const enabledOptionIndexes = computed(() =>
  displayedOptions.value.flatMap((option, index) => (option.disabled ? [] : [index])),
)
const resolvedInputType = computed(() => {
  if (props.variant !== 'secret') return props.inputType
  return isSecretVisible.value ? 'text' : 'password'
})
const isSecretWatching = computed(() => isSecretVisible.value || isSecretFocused.value)
const secretGazeOffset = computed(() => -Math.min(4 + props.modelValue.length * 0.5, 10))

function updateTextValue(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function openDropdown() {
  if (props.disabled) return
  isDropdownOpen.value = true
  dropdownSearch.value = ''
  const selectedIndex = displayedOptions.value.findIndex(
    (option) => option.value === props.modelValue,
  )
  highlightedOptionIndex.value =
    selectedIndex >= 0 ? selectedIndex : (enabledOptionIndexes.value[0] ?? -1)
  if (props.searchable) void nextTick(() => dropdownSearchElement.value?.focus())
}

function closeDropdown() {
  isDropdownOpen.value = false
}

function toggleDropdown() {
  if (isDropdownOpen.value) closeDropdown()
  else openDropdown()
}

function selectOption(option: TextFieldOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  closeDropdown()
}

function moveDropdownHighlight(direction: 1 | -1) {
  const indexes = enabledOptionIndexes.value
  if (!indexes.length) return

  const currentPosition = indexes.indexOf(highlightedOptionIndex.value)
  const nextPosition =
    currentPosition < 0 ? 0 : (currentPosition + direction + indexes.length) % indexes.length
  highlightedOptionIndex.value = indexes[nextPosition] ?? -1

  void nextTick(() => {
    document
      .getElementById(`${dropdownId.value}-${highlightedOptionIndex.value}`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function handleDropdownKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!isDropdownOpen.value) openDropdown()
    else moveDropdownHighlight(event.key === 'ArrowDown' ? 1 : -1)
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!isDropdownOpen.value) {
      openDropdown()
      return
    }
    const option = displayedOptions.value[highlightedOptionIndex.value]
    if (option) selectOption(option)
    return
  }

  if (event.key === 'Escape') closeDropdown()
  if (event.key === 'Home' && isDropdownOpen.value) {
    event.preventDefault()
    highlightedOptionIndex.value = enabledOptionIndexes.value[0] ?? -1
  }
  if (event.key === 'End' && isDropdownOpen.value) {
    event.preventDefault()
    highlightedOptionIndex.value =
      enabledOptionIndexes.value[enabledOptionIndexes.value.length - 1] ?? -1
  }
}

function handleDropdownSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDropdown()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveDropdownHighlight(event.key === 'ArrowDown' ? 1 : -1)
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const option = displayedOptions.value[highlightedOptionIndex.value]
    if (option) selectOption(option)
  }
}

function updateDropdownPosition() {
  if (!fieldElement.value || !isDropdownOpen.value) return
  if (isInsideDialog.value) {
    dropdownStyle.value = {}
    return
  }
  const rect = fieldElement.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: '99999',
  }
}

watch(isDropdownOpen, (open) => {
  if (open) {
    updateDropdownPosition()
    window.addEventListener('scroll', updateDropdownPosition, true)
    window.addEventListener('resize', updateDropdownPosition)
  } else {
    window.removeEventListener('scroll', updateDropdownPosition, true)
    window.removeEventListener('resize', updateDropdownPosition)
  }
})
watch(dropdownSearch, () => {
  highlightedOptionIndex.value = enabledOptionIndexes.value[0] ?? -1
})

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Node
  if (!fieldElement.value?.contains(target) && !dropdownElement.value?.contains(target)) {
    closeDropdown()
  }
}

onMounted(() => {
  isInsideDialog.value = Boolean(fieldElement.value?.closest('dialog'))
  document.addEventListener('click', handleDocumentClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('scroll', updateDropdownPosition, true)
  window.removeEventListener('resize', updateDropdownPosition)
})
</script>

<template>
  <div
    ref="fieldElement"
    class="text-field"
    :class="[
      `text-field--${state}`,
      {
        'text-field--empty': isEmpty,
        'text-field--disabled': disabled,
        'text-field--dropdown-open': isDropdownOpen,
        'text-field--secret': variant === 'secret',
      },
    ]"
  >
    <label v-if="label" class="text-field__label" :for="fieldId">
      {{ label }}<span v-if="required" class="text-field__required">*</span>
    </label>

    <div class="text-field__control">
      <span v-if="unit" class="text-field__unit">{{ unit }}</span>

      <input
        v-if="variant !== 'dropdown'"
        :id="fieldId"
        class="text-field__input"
        :value="modelValue"
        :type="resolvedInputType"
        :name="name"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :pattern="pattern"
        :disabled="disabled"
        :required="required"
        :aria-invalid="state === 'error'"
        :aria-describedby="supportText ? supportId : undefined"
        @input="updateTextValue"
        @focus="isSecretFocused = true"
        @blur="isSecretFocused = false"
      />

      <button
        v-else
        :id="fieldId"
        class="text-field__input text-field__select"
        type="button"
        :disabled="disabled"
        role="combobox"
        aria-haspopup="listbox"
        :aria-expanded="isDropdownOpen"
        :aria-controls="dropdownId"
        :aria-invalid="state === 'error'"
        :aria-describedby="supportText ? supportId : undefined"
        @click="toggleDropdown"
        @keydown="handleDropdownKeydown"
      >
        {{ selectedOption?.label ?? placeholder }}
      </button>

      <AppIcon
        v-if="variant === 'dropdown'"
        class="text-field__icon"
        :source="icons.base.arrowDown"
      />

      <button
        v-if="variant === 'secret'"
        class="text-field__secret-toggle"
        type="button"
        :disabled="disabled"
        :aria-label="isSecretVisible ? 'Hide password' : 'Show password'"
        :aria-pressed="isSecretVisible"
        @click="isSecretVisible = !isSecretVisible"
      >
        <span
          class="text-field__secret-character"
          :class="{ 'text-field__secret-character--visible': isSecretWatching }"
          aria-hidden="true"
        >
          <SecretCharacter :awake="isSecretWatching" :gaze="secretGazeOffset" />
        </span>
      </button>

      <Teleport to="body" :disabled="isInsideDialog">
        <Transition name="text-field-dropdown">
          <div
            v-if="variant === 'dropdown' && isDropdownOpen"
            :id="dropdownId"
            ref="dropdownElement"
            class="text-field__dropdown"
            :style="dropdownStyle"
            role="listbox"
            :aria-label="label"
          >
            <div v-if="searchable" class="text-field__dropdown-search">
              <input
                ref="dropdownSearchElement"
                v-model="dropdownSearch"
                type="search"
                :placeholder="searchPlaceholder"
                :aria-label="searchPlaceholder"
                @keydown="handleDropdownSearchKeydown"
              />
            </div>
            <button
              v-for="(option, index) in displayedOptions"
              :id="`${dropdownId}-${index}`"
              :key="option.value"
              class="text-field__option"
              :class="{
                'text-field__option--selected': option.value === modelValue,
                'text-field__option--highlighted': index === highlightedOptionIndex,
              }"
              type="button"
              role="option"
              :aria-selected="option.value === modelValue"
              :disabled="option.disabled"
              @pointerenter="highlightedOptionIndex = index"
              @click="selectOption(option)"
            >
              <span>{{ option.label }}</span>
              <span
                v-if="option.value === modelValue"
                class="text-field__selected-dot"
                aria-hidden="true"
              />
            </button>
            <p v-if="!displayedOptions.length" class="text-field__empty">{{ emptyText }}</p>
          </div>
        </Transition>
      </Teleport>
    </div>

    <p v-if="supportText" :id="supportId" class="text-field__support">
      {{ supportText }}
    </p>
  </div>
</template>

<style scoped>
.text-field {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-xs);
  color: var(--semantic-color-text-text-primary);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-medium);
}

.text-field__label {
  line-height: var(--line-height-label);
  font-weight: var(--typography-font-weight-medium);
}

.text-field__required {
  color: var(--semantic-color-error-error-text);
}

.text-field__control {
  position: relative;
  box-sizing: border-box;
  display: flex;
  width: 100%;
  height: 3rem;
  align-items: center;
  gap: 0.375rem;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
  font-size: var(--font-size-body-medium);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.text-field__control:focus-within,
.text-field--focused .text-field__control,
.text-field--dropdown-open .text-field__control {
  border-color: var(--semantic-color-action-borders-border-focus);
  box-shadow: 0 0 0 1px var(--semantic-color-action-borders-border-focus);
}

.text-field--error .text-field__control {
  border-color: var(--semantic-color-error-error-text);
  box-shadow: 0 0 0 0.5px var(--semantic-color-error-error-text);
}

.text-field__unit {
  flex-shrink: 0;
  line-height: var(--line-height-body);
}

.text-field__input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: var(--line-height-body);
}

.text-field__input::placeholder,
.text-field--empty .text-field__select {
  color: var(--semantic-color-text-text-muted);
  opacity: 1;
}

.text-field__select {
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-field__icon {
  display: block;
  width: var(--icon-size-16);
  height: var(--icon-size-16);
  flex-shrink: 0;
  pointer-events: none;
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.text-field__secret-toggle {
  position: absolute;
  top: 50%;
  right: var(--space-xs);
  display: grid;
  width: var(--icon-size-32);
  height: var(--icon-size-32);
  flex-shrink: 0;
  cursor: pointer;
  place-items: center;
  border: 0;
  border-radius: var(--corner-radius-full);
  padding: var(--space-xxs);
  background: transparent;
  transform: translateY(-50%);
}

.text-field--secret .text-field__input {
  padding-right: 2rem;
}

.text-field__secret-character {
  display: grid;
  width: var(--icon-size-24);
  height: var(--icon-size-24);
  transition: transform 220ms cubic-bezier(0.22, 1.35, 0.36, 1);
}

.text-field__secret-toggle:hover .text-field__secret-character {
  transform: scale(1.08);
}

.text-field__secret-toggle:active .text-field__secret-character {
  transform: scale(0.9);
}

.text-field__secret-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.text-field--dropdown-open .text-field__icon {
  transform: rotate(180deg);
}

.text-field__dropdown {
  position: absolute;
  z-index: var(--z-popover);
  top: calc(100% + var(--space-xxs));
  right: -1px;
  left: -1px;
  display: grid;
  max-height: 14rem;
  overflow-y: auto;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-md);
  padding: var(--space-xxs);
  background: var(--semantic-color-background-bg-elevated);
  box-shadow: var(--effect-shadow-lg);
  transform-origin: top;
}

.text-field__dropdown-search {
  padding: var(--space-xxs);
}

.text-field__dropdown-search input {
  width: 100%;
  height: 2.5rem;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-sm);
  outline: 0;
  padding: var(--space-xs) var(--space-sm);
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
  font: inherit;
}

.text-field__dropdown-search input:focus {
  border-color: var(--semantic-color-action-borders-border-focus);
}

.text-field__dropdown-search input::-webkit-search-cancel-button {
  display: none;
}

.text-field__empty {
  margin: 0;
  padding: var(--space-md);
  color: var(--semantic-color-text-text-muted);
  text-align: center;
}

.text-field__option {
  display: flex;
  width: 100%;
  min-height: 2.5rem;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
  cursor: pointer;
  border: 0;
  border-radius: var(--corner-radius-sm);
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  color: var(--semantic-color-text-text-primary);
  font: inherit;
  line-height: var(--line-height-body);
  text-align: left;
}

.text-field__option--highlighted {
  background: var(--semantic-color-background-bg-surface-hover);
}

.text-field__option--selected {
  background: var(--semantic-color-background-bg-surface-selected);
  font-weight: var(--typography-font-weight-medium);
}

.text-field__option:disabled {
  cursor: not-allowed;
  color: var(--semantic-color-text-text-disabled);
}

.text-field__selected-dot {
  width: var(--space-xs);
  height: var(--space-xs);
  flex-shrink: 0;
  border-radius: var(--corner-radius-full);
  background: var(--semantic-color-text-text-primary);
}

.text-field-dropdown-enter-active,
.text-field-dropdown-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.text-field-dropdown-enter-from,
.text-field-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-0.375rem) scaleY(0.96);
}

.text-field__support {
  margin: 0;
  color: var(--semantic-color-text-text-muted);
  font-size: var(--font-size-label-small);
  line-height: var(--line-height-label);
  font-weight: var(--typography-font-weight-medium);
}

.text-field--error .text-field__support {
  color: var(--semantic-color-error-error-text);
}

.text-field--disabled {
  color: var(--semantic-color-text-text-disabled);
}

.text-field--disabled .text-field__control {
  border-color: var(--semantic-color-border-border-disabled);
  background: var(--semantic-color-action-backgrounds-bg-disabled);
}

.text-field--disabled .text-field__input,
.text-field--disabled .text-field__select {
  cursor: not-allowed;
  color: var(--semantic-color-text-text-disabled);
}

@media (prefers-reduced-motion: reduce) {
  .text-field__control {
    transition: none;
  }

  .text-field__icon,
  .text-field__secret-character,
  .text-field-dropdown-enter-active,
  .text-field-dropdown-leave-active {
    transition: none;
  }
}
</style>
