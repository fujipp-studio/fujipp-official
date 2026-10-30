<script setup lang="ts">
import { computed } from 'vue'
import { AppTextField } from '@/shared/ui'
import AppTextArea from '@/shared/ui/fields/AppTextArea.vue'
import FeatureSettingToggle from './FeatureSettingToggle.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import type { TicketCategory } from '../config/ticket-config'
const props = defineProps<{ modelValue?: TicketCategory['welcome']; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: TicketCategory['welcome']] }>()
const { text } = useFeatureEditor()
const defaults = computed(() => ({
  title: props.label || 'Ticket',
  description: '{{user}} · {{category}}',
  imageUrl: '',
}))
function set(field: 'title' | 'description' | 'imageUrl', value: string) {
  emit('update:modelValue', { ...(props.modelValue ?? defaults.value), [field]: value })
}
function toggle(enabled: boolean) {
  emit('update:modelValue', enabled ? { ...defaults.value } : undefined)
}
</script>
<template>
  <div class="space-y-md border-t border-border-subtle pt-md" data-ticket-welcome>
    <FeatureSettingToggle
      :model-value="Boolean(modelValue)"
      :label="text('Custom welcome for this topic', 'ข้อความต้อนรับแยกสำหรับหัวข้อนี้')"
      :description="
        text(
          'When off, use the shared welcome design. Answers appear in separate boxes underneath, with controls at the bottom.',
          'เมื่อปิดจะใช้ดีไซน์ต้อนรับหลัก คำตอบจะเป็นกล่องแยกด้านล่างและวางปุ่มท้ายข้อความ',
        )
      "
      @update:model-value="toggle"
    />
    <template v-if="modelValue">
      <AppTextField
        :model-value="modelValue.title"
        :maxlength="256"
        :label="text('Welcome title', 'หัวข้อข้อความต้อนรับ')"
        required
        @update:model-value="set('title', $event)"
      />
      <AppTextArea
        :model-value="modelValue.description"
        :maxlength="3500"
        :label="text('Welcome message', 'ข้อความต้อนรับ')"
        @update:model-value="set('description', $event)"
      />
      <AppTextField
        :model-value="modelValue.imageUrl"
        :maxlength="2048"
        :label="text('Welcome image URL', 'ลิงก์รูปภาพต้อนรับ')"
        :support-text="
          text(
            'Optional HTTPS image/GIF URL. Text supports {{user}}, {{category}} and {{id}}.',
            'ใส่ HTTPS ของรูปหรือ GIF เว้นว่างได้ ข้อความรองรับ {{user}}, {{category}} และ {{id}}',
          )
        "
        @update:model-value="set('imageUrl', $event)"
      />
    </template>
  </div>
</template>
