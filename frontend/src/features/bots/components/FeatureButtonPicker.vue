<script setup lang="ts">
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
defineProps<{ options: Array<{ value: string; label: string }>; disabled?: boolean }>()
const emit = defineEmits<{ select: [action: string] }>()
const { text } = useFeatureEditor()
</script>

<template>
  <AppTextField
    v-if="options.length"
    class="feature-button-picker min-w-0 self-start"
    data-feature-button-picker
    variant="dropdown"
    model-value=""
    :label="text('Add feature button', 'เพิ่มปุ่ม Feature')"
    :placeholder="text('+ Feature button', '+ ปุ่ม Feature')"
    :options="options"
    :disabled="disabled"
    @update:model-value="emit('select', $event)"
  />
</template>

<style scoped>
.feature-button-picker {
  width: auto;
  max-width: 100%;
}
/* Keep the accessible label while the action itself is the visible prompt. */
.feature-button-picker :deep(.text-field__label) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
</style>
