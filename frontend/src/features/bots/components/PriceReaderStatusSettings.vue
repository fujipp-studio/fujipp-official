<script setup lang="ts">
import { computed } from 'vue'
import { MessageSquare } from 'lucide-vue-next'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import PriceReaderTemplateField from './PriceReaderTemplateField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { text, values, configuration, license } = useFeatureEditor()
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const value = (key: string) => String(values.value[key] ?? '')
const statusFields = computed(() =>
  [
    {
      key: 'PRICE_READER_NOT_FOUND_TEXT',
      label: text('No supported price detected', 'ข้อความเมื่ออ่านไม่พบราคา'),
      variables: [],
    },
    {
      key: 'PRICE_READER_OCR_ERROR_TEXT',
      label: text('Image processing failed', 'ข้อความเมื่ออ่านรูปผิดพลาด'),
      variables: [],
    },
    {
      key: 'PRICE_READER_UNMATCHED_PRICE_TEXT',
      label: text('No matching shop price', 'ข้อความเมื่อไม่มีคู่ราคา'),
      variables: ['discord_price', 'item_name'],
    },
    {
      key: 'PRICE_READER_ERROR_ITEM_TEMPLATE',
      label: text('Failed image template', 'รูปแบบผลลัพธ์ต่อรูปที่ผิดพลาด'),
      variables: ['result_index', 'error_message'],
    },
  ].filter((item) => field(item.key)),
)
</script>

<template>
  <FeatureSettingsCard
    :icon="MessageSquare"
    :title="text('Status messages', 'ข้อความแต่ละสถานะ')"
    :description="
      text(
        'Applies both when all images fail and when only some fail. Design the outer message in Message design.',
        'ใช้ได้ทั้งกรณีอ่านไม่สำเร็จทุกรูปและบางรูป ส่วนกรอบข้อความแก้ได้ในออกแบบข้อความ',
      )
    "
  >
    <div class="space-y-lg">
      <div v-for="item in statusFields" :key="item.key" class="space-y-sm">
        <p
          v-if="license?.version === '3.2.0' && value(item.key) === '{{default}}'"
          class="text-sm text-text-secondary"
        >
          {{ item.label }} ·
          {{ text('Automatic · follows bot response language', 'อัตโนมัติ · ตามภาษาที่บอทตอบ') }}
        </p>
        <AppButton
          v-if="license?.version === '3.2.0' && value(item.key) === '{{default}}'"
          variant="secondary"
          class="!w-auto"
          @click="values[item.key] = ''"
          >{{ text('Write custom text', 'เขียนข้อความเอง') }}</AppButton
        >
        <PriceReaderTemplateField
          v-else
          :model-value="value(item.key)"
          :label="item.label"
          :variables="item.variables"
          :maxlength="item.key === 'PRICE_READER_ERROR_ITEM_TEMPLATE' ? 4000 : 1000"
          :rows="3"
          @update:model-value="values[item.key] = $event"
        />
        <AppButton
          v-if="
            license?.version === '3.2.0' &&
            item.key !== 'PRICE_READER_ERROR_ITEM_TEMPLATE' &&
            value(item.key) !== '{{default}}'
          "
          variant="secondary"
          class="!w-auto"
          @click="values[item.key] = '{{default}}'"
          >{{ text('Use automatic text', 'ใช้ข้อความอัตโนมัติ') }}</AppButton
        >
      </div>
    </div>
  </FeatureSettingsCard>
</template>
