<script setup lang="ts">
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { text } = useFeatureEditor()
</script>
<template>
  <AppTextField
    class="mb-xs"
    variant="dropdown"
    :model-value="modelValue"
    :label="text('Back button appearance', 'รูปแบบปุ่มกลับ')"
    :options="[
      { value: 'TEXT', label: text('Emoji and text', 'อีโมจิพร้อมข้อความ') },
      { value: 'EMOJI_ONLY', label: text('◀️ Emoji only', '◀️ อีโมจิอย่างเดียว') },
    ]"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
