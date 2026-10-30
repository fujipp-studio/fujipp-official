<script setup lang="ts">
import { computed } from 'vue'
import AppTextArea from '@/shared/ui/fields/AppTextArea.vue'
import FeatureSettingToggle from './FeatureSettingToggle.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import {
  defaultTicketCancellationNotice,
  type TicketBehavior,
  type TicketCancellationNotice,
} from '../config/ticket-config'
const props = defineProps<{ modelValue: TicketBehavior }>()
const emit = defineEmits<{ 'update:modelValue': [value: TicketBehavior] }>()
const { text } = useFeatureEditor()
const notice = computed(() => ({
  ...defaultTicketCancellationNotice,
  ...props.modelValue.cancellationNotice,
}))
function update(patch: Partial<TicketCancellationNotice>) {
  emit('update:modelValue', {
    ...props.modelValue,
    cancellationNotice: { ...notice.value, ...patch },
  })
}
</script>

<template>
  <div class="space-y-lg" data-ticket-cancellation-notice>
    <FeatureSettingToggle
      :model-value="notice.enabled"
      :label="text('Announce auto-close cancellation', 'แจ้งข้อความหลังยกเลิกปิดอัตโนมัติ')"
      :description="
        text(
          'Send a message in the ticket when a moderator cancels its timer or approves an exemption request.',
          'ส่งข้อความลงห้องตั๋วเมื่อผู้ดูแลยกเลิกเวลาปิด หรืออนุมัติคำขอยกเว้น',
        )
      "
      @update:model-value="update({ enabled: $event })"
    />
    <AppTextArea
      v-if="notice.enabled"
      :model-value="notice.message"
      :label="text('Cancellation message', 'ข้อความหลังยกเลิกปิดอัตโนมัติ')"
      :maxlength="2000"
      required
      :support-text="
        text(
          'Up to 2,000 characters. Markdown is supported. The message does not ping mentions.',
          'สูงสุด 2,000 ตัวอักษร รองรับ Markdown โดยข้อความจะไม่ส่งแจ้งเตือนผ่าน mention',
        )
      "
      @update:model-value="update({ message: $event })"
    />
    <p class="text-sm text-text-secondary">
      {{
        text(
          'Turning off this announcement keeps the timer cancellation and the private result shown to the person using the command or button.',
          'ปิดข้อความแจ้งเตือนได้โดยยังยกเลิกเวลาได้ตามปกติ และผู้ใช้คำสั่งหรือปุ่มยังเห็นผลลัพธ์แบบส่วนตัว',
        )
      }}
    </p>
  </div>
</template>
