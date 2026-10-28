<script setup lang="ts">
import { useFeatureEditor } from '../composables/featureEditorContext'
defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { text } = useFeatureEditor()
</script>

<template>
  <div class="mb-xs">
    <label class="component-field">
      <span>{{ text('After this action', 'เมื่อกดปุ่มนี้') }}</span>
      <select
        class="field-control h-10"
        :value="modelValue"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option value="UPDATE">{{ text('Update original message', 'อัปเดตข้อความเดิม') }}</option>
        <option value="NEW_MESSAGE">{{ text('Send a new message', 'ส่งข้อความใหม่') }}</option>
      </select>
    </label>
    <small class="text-xs text-text-muted">{{
      text(
        'For envelopes, applies after payment succeeds. Discord cannot change a Components V2 message back to Embed; choose a new message in that case.',
        'ซองอั่งเปา: ใช้หลังชำระสำเร็จ · Discord เปลี่ยนข้อความ Components V2 กลับเป็น Embed ไม่ได้ ให้เลือกส่งข้อความใหม่ในกรณีนี้',
      )
    }}</small>
  </div>
</template>
