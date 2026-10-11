<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    variables?: string[]
    maxlength?: number
    required?: boolean
    rows?: number
  }>(),
  { variables: () => [], maxlength: 4000, required: true, rows: 5 },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const id = useId()
const input = ref<HTMLTextAreaElement>()
const { locale } = useI18n()
const token = (variable: string) => '{{' + variable + '}}'
async function insert(variable: string) {
  const start = input.value?.selectionStart ?? props.modelValue.length
  const end = input.value?.selectionEnd ?? start
  const token = '{{' + variable + '}}'
  const value = props.modelValue.slice(0, start) + token + props.modelValue.slice(end)
  if (value.length > props.maxlength) return
  emit('update:modelValue', value)
  await nextTick()
  input.value?.focus()
  input.value?.setSelectionRange(start + token.length, start + token.length)
}
</script>

<template>
  <div class="min-w-0 space-y-sm">
    <label :for="id" class="block text-sm font-medium">{{ label }}</label>
    <textarea
      :id="id"
      ref="input"
      :value="modelValue"
      :rows="rows"
      :maxlength="maxlength"
      :required="required"
      :aria-invalid="required && !modelValue.trim()"
      class="field-control resize-y py-sm"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <div v-if="variables.length" class="flex flex-wrap gap-xs">
      <button
        v-for="variable in variables"
        :key="variable"
        type="button"
        class="rounded-md border border-border-default bg-bg-default px-sm py-xs text-xs [overflow-wrap:anywhere] hover:bg-bg-surface-hover"
        :aria-label="(locale === 'th' ? 'แทรก ' : 'Insert ') + variable"
        @click="insert(variable)"
      >
        {{ token(variable) }}
      </button>
    </div>
  </div>
</template>
