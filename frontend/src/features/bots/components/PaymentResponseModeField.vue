<script setup lang="ts">
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { text } = useFeatureEditor()
</script>

<template>
  <div class="mb-xs">
    <AppTextField
      variant="dropdown"
      :model-value="modelValue"
      :label="text('After this action', 'เมื่อกดปุ่มนี้')"
      :options="[
        { value: 'UPDATE', label: text('Update original message', 'อัปเดตข้อความเดิม') },
        { value: 'NEW_MESSAGE', label: text('Send a new message', 'ส่งข้อความใหม่') },
      ]"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <small class="text-xs text-text-muted">{{
      text(
        'For envelopes, applies after payment succeeds. Discord cannot change a Components V2 message back to Embed; choose a new message in that case.',
        'ซองอั่งเปา: ใช้หลังชำระสำเร็จ · Discord เปลี่ยนข้อความ Components V2 กลับเป็น Embed ไม่ได้ ให้เลือกส่งข้อความใหม่ในกรณีนี้',
      )
    }}</small>
  </div>
</template>
