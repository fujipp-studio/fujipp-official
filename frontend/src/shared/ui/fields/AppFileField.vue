<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'

import type { TextFieldState } from './types'
import AppImageLightbox from '../dialogs/AppImageLightbox.vue'

const props = withDefaults(defineProps<{
  modelValue?: File | null
  state?: TextFieldState
  label: string
  accept?: string
  supportText?: string
  placeholder?: string
  showPreview?: boolean
  disabled?: boolean
  required?: boolean
}>(), {
  modelValue: null,
  state: 'default',
  accept: undefined,
  supportText: '',
  placeholder: 'No image selected',
  showPreview: true,
  disabled: false,
  required: false,
})

const emit = defineEmits<{ 'update:modelValue': [file: File | null] }>()
const input = ref<HTMLInputElement>()
const generatedId = useId()
const fieldId = computed(() => `file-field-${generatedId}`)
const supportId = computed(() => `${fieldId.value}-support`)
const previewUrl = ref('')
const lightboxOpen = ref(false)
const fileSize = computed(() => {
  if (!props.modelValue) return ''
  const megabytes = props.modelValue.size / 1024 / 1024
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MiB` : `${Math.max(1, Math.round(props.modelValue.size / 1024))} KiB`
})

function handleChange(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).files?.[0] ?? null)
}

function revokePreview() {
  if (!previewUrl.value) return
  URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

watch(
  () => props.modelValue,
  (file) => {
    revokePreview()
    if (!file && input.value) input.value.value = ''
    if (file && props.showPreview && file.type.startsWith('image/')) {
      previewUrl.value = URL.createObjectURL(file)
    }
  },
  { immediate: true },
)

onBeforeUnmount(revokePreview)
</script>

<template>
  <div class="file-field" :class="[`file-field--${state}`, { 'file-field--disabled': disabled }]">
    <label class="file-field__label" :for="fieldId">
      {{ label }}<span v-if="required" class="file-field__required">*</span>
    </label>
    <input
      :id="fieldId"
      ref="input"
      class="file-field__native"
      hidden
      type="file"
      :accept="accept"
      :disabled="disabled"
      :required="required"
      :aria-invalid="state === 'error'"
      :aria-describedby="supportText ? supportId : undefined"
      @change="handleChange"
    />
    <button
      class="file-field__control"
      type="button"
      :disabled="disabled"
      :aria-describedby="supportText ? supportId : undefined"
      @click="input?.click()"
    >
      <span class="file-field__name" :class="{ 'file-field__name--empty': !modelValue }">
        {{ modelValue?.name ?? placeholder }}
      </span>
      <span class="file-field__action" aria-hidden="true">Choose image</span>
    </button>
    <div v-if="modelValue && showPreview" class="file-field__preview">
      <button v-if="previewUrl" type="button" class="file-field__preview-button" aria-label="View selected image full screen" @click="lightboxOpen = true">
        <img :src="previewUrl" alt="Selected image preview" />
      </button>
      <div>
        <strong>{{ modelValue.name }}</strong>
        <span>{{ fileSize }}</span>
      </div>
      <button type="button" aria-label="Remove selected image" @click="emit('update:modelValue', null)">
        Remove
      </button>
    </div>
    <p v-if="supportText" :id="supportId" class="file-field__support">{{ supportText }}</p>
    <AppImageLightbox v-if="previewUrl" v-model:open="lightboxOpen" :src="previewUrl" alt="Selected image preview" :caption="modelValue?.name" />
  </div>
</template>

<style scoped>
.file-field { display: flex; width: 100%; min-width: 0; flex-direction: column; align-items: stretch; gap: var(--space-xs); color: var(--semantic-color-text-text-primary); font-family: var(--font-family-sans); font-size: var(--font-size-label-medium); }
.file-field__label { line-height: var(--line-height-label); font-weight: var(--typography-font-weight-medium); }
.file-field__required { color: var(--semantic-color-error-error-text); }
.file-field__native { display: none !important; }
.file-field__control { box-sizing: border-box; display: flex; width: 100%; height: 3rem; min-width: 0; align-items: center; justify-content: space-between; gap: var(--space-md); cursor: pointer; border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--corner-radius-md); padding: var(--space-sm) var(--space-md); background: var(--semantic-color-background-bg-default); color: inherit; font: inherit; font-size: var(--font-size-body-medium); text-align: left; transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease; }
.file-field__control:focus-visible, .file-field--focused .file-field__control { outline: 0; border-color: var(--semantic-color-action-borders-border-focus); box-shadow: 0 0 0 1px var(--semantic-color-action-borders-border-focus); }
.file-field--error .file-field__control { border-color: var(--semantic-color-error-error-text); box-shadow: 0 0 0 0.5px var(--semantic-color-error-error-text); }
.file-field__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-field__name--empty { color: var(--semantic-color-text-text-muted); }
.file-field__action { flex-shrink: 0; padding: var(--space-xxs) var(--space-sm); border-radius: var(--corner-radius-sm); background: var(--semantic-color-background-bg-surface-hover); font-size: var(--font-size-label-small); font-weight: var(--typography-font-weight-medium); }
.file-field__preview { display: grid; grid-template-columns: 4.5rem minmax(0, 1fr) auto; align-items: center; gap: var(--space-sm); overflow: hidden; padding: var(--space-xs); border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--corner-radius-md); background: var(--semantic-color-background-bg-surface); }
.file-field__preview-button { width: 4.5rem; height: 3.25rem; overflow: hidden; border: 0; border-radius: var(--corner-radius-sm); padding: 0; background: transparent; cursor: zoom-in; }
.file-field__preview img { width: 100%; height: 100%; object-fit: cover; transition: transform 160ms ease; }
.file-field__preview-button:hover img { transform: scale(1.05); }
.file-field__preview > div { display: grid; min-width: 0; gap: var(--space-xxs); }
.file-field__preview strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-field__preview span { color: var(--semantic-color-text-text-muted); font-size: var(--font-size-label-small); }
.file-field__preview button { padding: var(--space-xs); border: 0; background: transparent; color: var(--semantic-color-error-error-text); cursor: pointer; font: inherit; font-size: var(--font-size-label-small); }
.file-field__support { margin: 0; color: var(--semantic-color-text-text-muted); font-size: var(--font-size-label-small); line-height: var(--line-height-label); font-weight: var(--typography-font-weight-medium); }
.file-field--error .file-field__support { color: var(--semantic-color-error-error-text); }
.file-field--disabled { color: var(--semantic-color-text-text-disabled); }
.file-field--disabled .file-field__control { cursor: not-allowed; border-color: var(--semantic-color-border-border-disabled); background: var(--semantic-color-action-backgrounds-bg-disabled); color: var(--semantic-color-text-text-disabled); }
@media (prefers-reduced-motion: reduce) { .file-field__control { transition: none; } }
</style>
