<script setup lang="ts">
import { computed } from 'vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import EmbedMessageEditor from './EmbedMessageEditor.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
const {
  text,
  usesPresentationDesigner,
  visiblePresentationSlots,
  editablePresentationSlots,
  walletActiveSlotKey,
  selectPresentationSlot,
  presentationSlotLabel,
} = useFeatureEditor()
const messageOptions = computed(() =>
  visiblePresentationSlots.value.map((slot) => ({
    value: slot.key,
    label: presentationSlotLabel(slot),
  })),
)
</script>

<template>
  <div class="space-y-md">
    <div
      v-if="usesPresentationDesigner && visiblePresentationSlots.length > 1"
      class="grid gap-md tablet:grid-cols-2"
    >
      <AppTextField
        variant="dropdown"
        :model-value="editablePresentationSlots[0]?.key ?? walletActiveSlotKey"
        :label="text('Message', 'ข้อความ')"
        :options="messageOptions"
        @update:model-value="selectPresentationSlot($event)"
      />
    </div>
    <EmbedMessageEditor
      v-for="slot in editablePresentationSlots"
      :key="slot.slotId"
      :message-slot="slot"
    />
    <p
      v-if="!editablePresentationSlots.length"
      class="rounded-lg border border-dashed border-border-default p-lg text-sm text-text-muted"
    >
      {{ text('No messages currently use Embed.', 'ยังไม่มีข้อความที่ใช้ Embed') }}
    </p>
  </div>
</template>
