<script setup lang="ts">
import { nextTick, ref, type Component } from 'vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'

const props = defineProps<{
  modelValue: string
  label: string
  idPrefix: string
  categories: readonly { key: string; label: string; icon?: Component }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const tabList = ref<HTMLElement>()
async function navigate(event: KeyboardEvent, index: number) {
  let next = index
  if (event.key === 'ArrowRight') next = (index + 1) % props.categories.length
  else if (event.key === 'ArrowLeft')
    next = (index - 1 + props.categories.length) % props.categories.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = props.categories.length - 1
  else return
  event.preventDefault()
  const category = props.categories[next]
  if (!category) return
  emit('update:modelValue', category.key)
  await nextTick()
  tabList.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]').item(next)?.focus()
}
</script>

<template>
  <div class="tablet:hidden">
    <AppTextField
      variant="dropdown"
      :model-value="modelValue"
      :label="label"
      :options="categories.map((category) => ({ value: category.key, label: category.label }))"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
  <div ref="tabList" role="tablist" :aria-label="label" class="hidden flex-wrap gap-xs tablet:flex">
    <button
      v-for="(category, index) in categories"
      :id="idPrefix + '-tab-' + category.key"
      :key="category.key"
      type="button"
      role="tab"
      :aria-selected="modelValue === category.key"
      :aria-controls="idPrefix + '-panel-' + category.key"
      :tabindex="modelValue === category.key ? 0 : -1"
      class="inline-flex items-center gap-xs rounded-lg px-sm py-sm text-sm font-medium tablet:px-md"
      :class="
        modelValue === category.key
          ? 'bg-bg-inverse text-text-inverse'
          : 'text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary'
      "
      @click="emit('update:modelValue', category.key)"
      @keydown="navigate($event, index)"
    >
      <component :is="category.icon" v-if="category.icon" :size="18" aria-hidden="true" />
      {{ category.label }}
    </button>
  </div>
</template>
