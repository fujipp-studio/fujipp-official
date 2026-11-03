<script setup lang="ts">
import { TextCursorInput } from 'lucide-vue-next'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import PriceReaderResultEditor from './PriceReaderResultEditor.vue'
import PriceReaderTemplateField from './PriceReaderTemplateField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
const { text, values, configuration, license, priceReaderHelpers } = useFeatureEditor()
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const value = (key: string) => String(values.value[key] ?? '')
const classified = Boolean(
  configuration.value?.fields.some((item) => item.key === 'PRICE_READER_PRICING_MODE'),
)
</script>
<template>
  <FeatureSettingsCard
    :icon="TextCursorInput"
    :title="text('Text for each image', 'ข้อความผลลัพธ์ต่อรูป')"
    :description="
      text(
        'Customize the information shown for every successfully read image.',
        'แต่งข้อมูลที่แสดงสำหรับแต่ละรูปที่อ่านราคาสำเร็จ',
      )
    "
  >
    <PriceReaderResultEditor
      :model-value="value('PRICE_READER_RESULT_BLOCKS')"
      :template="value('PRICE_READER_RESULTS_ITEM_TEMPLATE')"
      :mode="field('PRICE_READER_RESULT_MODE') ? value('PRICE_READER_RESULT_MODE') : undefined"
      :with-markup="Boolean(license?.version.startsWith('1.'))"
      :extra-variables="classified ? (priceReaderHelpers?.priceReaderVariables ?? []) : []"
      :can-use-blocks="Boolean(field('PRICE_READER_RESULT_BLOCKS'))"
      @update:model-value="values.PRICE_READER_RESULT_BLOCKS = $event"
      @update:template="values.PRICE_READER_RESULTS_ITEM_TEMPLATE = $event"
      @update:mode="field('PRICE_READER_RESULT_MODE') && (values.PRICE_READER_RESULT_MODE = $event)"
    />
    <div v-if="field('PRICE_READER_RESULTS_SEPARATOR')" class="mt-lg">
      <PriceReaderTemplateField
        :model-value="value('PRICE_READER_RESULTS_SEPARATOR')"
        :label="text('Separator between images', 'ตัวคั่นระหว่างรูป')"
        :required="false"
        :maxlength="100"
        :rows="3"
        @update:model-value="values.PRICE_READER_RESULTS_SEPARATOR = $event"
      />
    </div>
  </FeatureSettingsCard>
</template>
