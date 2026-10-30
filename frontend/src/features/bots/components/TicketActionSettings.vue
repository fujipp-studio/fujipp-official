<script setup lang="ts">
import { computed } from 'vue'
import { AppTextField } from '@/shared/ui'
import { useFeatureEditor } from '../composables/featureEditorContext'
import {
  defaultTicketActions,
  type TicketAction,
  type TicketBehavior,
  type TicketDelivery,
} from '../config/ticket-config'
const props = defineProps<{
  modelValue: TicketBehavior
  command: string
  historyEnabled: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: TicketBehavior] }>()
const { text } = useFeatureEditor()
const actions = computed(() => ({ ...defaultTicketActions, ...props.modelValue.actions }))
const choices = computed(() => [
  { value: 'OFF', label: text('Off', 'ปิดใช้งาน') },
  { value: 'COMMAND', label: text('Commands only', 'เฉพาะคำสั่ง') },
  { value: 'BUTTON', label: text('Buttons only', 'เฉพาะปุ่ม') },
  { value: 'BOTH', label: text('Commands and buttons', 'คำสั่งและปุ่ม') },
])
const rows = computed(() => [
  { key: 'close' as const, label: text('Close ticket', 'ปิดตั๋ว'), commands: ['close'] },
  {
    key: 'schedule' as const,
    label: text('Set auto-close timer', 'ตั้งเวลาปิดอัตโนมัติ'),
    commands: ['auto-close minutes:60 mode:FROM_NOW'],
  },
  {
    key: 'autoClose' as const,
    label: text('Auto-close exemption', 'ยกเว้นปิดอัตโนมัติ'),
    commands: ['no-auto-close', 'approve-exemption', 'deny-exemption'],
  },
  {
    key: 'addUser' as const,
    label: text('Add ticket member', 'เพิ่มสมาชิกในตั๋ว'),
    commands: ['add-user member:@user'],
  },
  {
    key: 'history' as const,
    label: text('Discord history access', 'ประวัติใน Discord'),
    commands: ['history'],
  },
])
function setAction(key: TicketAction, mode: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    actions: { ...actions.value, [key]: mode as TicketDelivery },
  })
}
</script>

<template>
  <div class="mt-lg space-y-lg" data-ticket-actions>
    <AppTextField
      :model-value="modelValue.controlStyle ?? 'MANAGE'"
      variant="dropdown"
      :label="text('Ticket button layout', 'รูปแบบปุ่มในตั๋ว')"
      :options="[
        { value: 'MANAGE', label: text('Manage ticket menu', 'เมนูจัดการตั๋ว') },
        { value: 'DIRECT', label: text('Show action buttons directly', 'แสดงปุ่มการทำงานโดยตรง') },
      ]"
      :support-text="
        text(
          'To show only Close, choose direct buttons, enable Close buttons and use commands for other actions.',
          'หากต้องการเฉพาะปุ่มปิด ให้เลือกแสดงปุ่มโดยตรง เปิดปุ่มปิดตั๋ว และเลือกคำสั่งสำหรับงานอื่น',
        )
      "
      @update:model-value="
        emit('update:modelValue', {
          ...modelValue,
          controlStyle: $event as NonNullable<TicketBehavior['controlStyle']>,
        })
      "
    />
    <section v-for="row in rows" :key="row.key" class="space-y-sm">
      <AppTextField
        :model-value="actions[row.key]"
        variant="dropdown"
        :label="row.label"
        :options="choices"
        @update:model-value="setAction(row.key, $event)"
      />
      <p v-if="row.key === 'history' && !historyEnabled" class="text-sm text-text-secondary">
        {{
          text(
            'Enable Discord history in the History category to use this action.',
            'เปิดประวัติใน Discord ในหมวดประวัติแชทก่อนใช้งานส่วนนี้',
          )
        }}
      </p>
      <p
        v-else-if="['COMMAND', 'BOTH'].includes(actions[row.key])"
        class="break-words text-sm text-text-secondary"
      >
        {{ row.commands.map((item) => `/${command} ${item}`).join(' · ') }}
      </p>
    </section>
    <p class="text-sm text-text-secondary">
      {{
        text(
          'These choices change how actions are accessed, while administrator and closing role/user permissions still apply. Button layouts appear in newly opened tickets; disabled actions also reject old buttons and commands.',
          'ตัวเลือกเหล่านี้กำหนดช่องทางใช้งาน โดยยังตรวจสิทธิ์แอดมินและ Role/User ที่ปิดตั๋วได้ รูปแบบปุ่มแสดงในตั๋วที่เปิดใหม่ ส่วนช่องทางที่ปิดจะใช้ไม่ได้แม้กดปุ่มหรือคำสั่งเดิม',
        )
      }}
    </p>
  </div>
</template>
