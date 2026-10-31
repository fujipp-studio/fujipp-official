<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AppTextField } from '@/shared/ui'
import FeatureSettingToggle from './FeatureSettingToggle.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import type { TicketOpeningMentions } from '../config/ticket-config'

const props = defineProps<{ modelValue?: TicketOpeningMentions }>()
const emit = defineEmits<{ 'update:modelValue': [value: TicketOpeningMentions] }>()
const { text } = useFeatureEditor()
const mentions = computed(
  () => props.modelValue ?? { enabled: false, opener: false, roleIds: [], userIds: [] },
)
const roles = ref('')
const users = ref('')
let emitted = ''
watch(
  () => JSON.stringify(props.modelValue),
  (raw) => {
    if (raw === emitted) return
    roles.value = mentions.value.roleIds.join(', ')
    users.value = mentions.value.userIds.join(', ')
  },
  { immediate: true },
)
function update(patch: Partial<TicketOpeningMentions>) {
  const next = { ...mentions.value, ...patch }
  emitted = JSON.stringify(next)
  emit('update:modelValue', next)
}
function recipients(key: 'roleIds' | 'userIds', raw: string) {
  if (key === 'roleIds') roles.value = raw
  else users.value = raw
  update({ [key]: raw.split(/[\s,]+/).filter(Boolean) })
}
</script>

<template>
  <div class="space-y-md border-t border-border-subtle pt-md" data-ticket-opening-mentions>
    <FeatureSettingToggle
      :model-value="mentions.enabled"
      :label="text('Ping when a ticket opens', 'ส่ง Ping ตอนเปิดตั๋ว')"
      :description="
        text(
          'Send role and user mentions in the new ticket after its welcome message.',
          'ส่งแท็ก Role และผู้ใช้ในห้องตั๋วใหม่ หลังข้อความต้อนรับ',
        )
      "
      @update:model-value="update({ enabled: $event })"
    />
    <template v-if="mentions.enabled">
      <FeatureSettingToggle
        :model-value="mentions.opener"
        :label="text('Ping the ticket opener', 'Ping ผู้เปิดตั๋ว')"
        @update:model-value="update({ opener: $event })"
      />
      <AppTextField
        :model-value="roles"
        :label="text('Role IDs to ping', 'Role ID ที่ต้องการ Ping')"
        :support-text="
          text(
            'Up to 10 role IDs, separated by commas. Roles must have access to this ticket and be mentionable, or the bot needs Mention Everyone.',
            'คั่นด้วยจุลภาค สูงสุด 10 Role ต้องเข้าถึงห้องตั๋วได้ และเปิดให้แท็กได้ หรือบอทมีสิทธิ์ Mention Everyone',
          )
        "
        @update:model-value="recipients('roleIds', $event)"
      />
      <AppTextField
        :model-value="users"
        :label="text('User IDs to ping', 'User ID ที่ต้องการ Ping')"
        :support-text="
          text(
            'Up to 25 user IDs, separated by commas. Pinging does not grant ticket access; recipients need access through a support role, closing permissions or Administrator.',
            'คั่นด้วยจุลภาค สูงสุด 25 ผู้ใช้ การ Ping ไม่เพิ่มสิทธิ์ดูห้อง ผู้รับต้องมีสิทธิ์จาก Role ทีมดูแล สิทธิ์ปิดตั๋ว หรือ Administrator',
          )
        "
        @update:model-value="recipients('userIds', $event)"
      />
      <p class="text-sm text-text-secondary">
        {{
          text(
            'Applies to new tickets in this topic. Form answers and welcome text do not trigger extra pings.',
            'ใช้กับตั๋วใหม่ในหัวข้อนี้ ข้อความในแบบฟอร์มและข้อความต้อนรับจะไม่ส่ง Ping เพิ่ม',
          )
        }}
      </p>
    </template>
  </div>
</template>
