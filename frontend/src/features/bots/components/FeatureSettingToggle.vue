<script setup lang="ts">
import { useId, type Component } from 'vue'
import AppToggle from '@/shared/ui/buttons/AppToggle.vue'

defineProps<{
  modelValue: boolean
  label: string
  description?: string
  ariaLabel?: string
  icon?: Component
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const id = useId()
</script>

<template>
  <div class="flex items-start justify-between gap-md" data-feature-setting-toggle>
    <div class="flex min-w-0 items-start gap-sm">
      <component
        :is="icon"
        v-if="icon"
        :size="18"
        class="mt-xxs shrink-0 text-text-secondary"
        aria-hidden="true"
      />
      <div class="min-w-0">
        <p class="text-sm font-medium">{{ label }}</p>
        <p v-if="description" :id="id + '-description'" class="mt-xxs text-xs text-text-muted">
          {{ description }}
        </p>
      </div>
    </div>
    <AppToggle
      :model-value="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel || label"
      :aria-describedby="description ? id + '-description' : undefined"
      @change="emit('update:modelValue', $event)"
    />
  </div>
</template>
