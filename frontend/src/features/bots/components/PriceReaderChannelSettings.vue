<script setup lang="ts">
import { Hash } from 'lucide-vue-next'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureConfigField from './FeatureConfigField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { text } = useFeatureEditor()
</script>

<template>
  <FeatureSettingsCard
    :icon="Hash"
    :title="text('Discord channels', 'ช่อง Discord')"
    :description="
      text(
        'Choose where the bot reads screenshots and where members can order.',
        'กำหนดช่องรับรูปอ่านราคาและช่องที่ลูกค้าสั่งซื้อ',
      )
    "
  >
    <div class="space-y-lg">
      <FeatureConfigField field-key="PRICE_READER_CHANNEL_ID" />
      <FeatureConfigField
        field-key="PRICE_READER_ORDER_CHANNEL_ID"
        :support-text="
          text(
            'Optional · leave blank to omit the order link.',
            'ไม่บังคับ · เว้นว่างเพื่อไม่แสดงลิงก์สั่งซื้อ',
          )
        "
      />
    </div>
    <details class="mt-lg border-t border-border-subtle pt-md">
      <summary class="cursor-pointer text-sm font-medium">
        {{ text('How to copy a channel ID', 'วิธีคัดลอก Channel ID') }}
      </summary>
      <p class="mt-sm text-sm text-text-secondary">
        {{
          text(
            'Enable Developer Mode in Discord, then right-click the channel and choose Copy Channel ID.',
            'เปิด Developer Mode ใน Discord แล้วคลิกขวาที่ช่อง เลือก Copy Channel ID',
          )
        }}
      </p>
    </details>
  </FeatureSettingsCard>
</template>
