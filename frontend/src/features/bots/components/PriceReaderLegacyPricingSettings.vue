<script setup lang="ts">
import { Table2 } from 'lucide-vue-next'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureConfigField from './FeatureConfigField.vue'
import PriceMapEditor from './PriceMapEditor.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
const { values, text, configuration } = useFeatureEditor()
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const value = (key: string) => String(values.value[key] ?? '')
</script>
<template>
  <div class="space-y-lg">
    <FeatureSettingsCard
      v-if="field('PRICE_READER_PRICE_MAP')"
      :icon="Table2"
      :title="text('Shop prices', 'จับคู่ราคาขายของร้าน')"
      :description="
        text(
          'Enter Discord and shop prices in THB.',
          'กำหนดราคา Discord และราคาขายของร้าน หน่วยเป็นบาท',
        )
      "
    >
      <PriceMapEditor
        :model-value="value('PRICE_READER_PRICE_MAP')"
        @update:model-value="values.PRICE_READER_PRICE_MAP = $event"
      />
      <p class="mt-md text-xs text-text-muted">
        {{
          text(
            'The nearest price within the configured tolerance is used. Equal distances use the first row.',
            'ใช้คู่ราคาที่ใกล้ที่สุดภายในช่วงที่ตั้งไว้ หากห่างเท่ากันจะใช้แถวแรก',
          )
        }}
      </p>
    </FeatureSettingsCard>
    <FeatureSettingsCard
      v-if="field('PRICE_READER_MATCH_TOLERANCE_SATANG')"
      :title="text('Price matching', 'กฎจับคู่ราคา')"
      compact
    >
      <FeatureConfigField
        field-key="PRICE_READER_MATCH_TOLERANCE_SATANG"
        :label="text('Allowed difference', 'ความคลาดเคลื่อนที่ยอมรับ')"
      />
      <p class="mt-sm text-xs text-text-muted">
        {{
          text(
            'Set 0 for exact matches. Maximum ±50 THB.',
            'ตั้ง 0 เพื่อจับคู่ตรงราคาเท่านั้น สูงสุด ±50 บาท',
          )
        }}
      </p>
    </FeatureSettingsCard>
    <FeatureSettingsCard
      v-if="field('PRICE_READER_NO_NITRO_MARKUP_SATANG')"
      :title="text('Non-Nitro markup', 'ค่าบวกเมื่อไม่มี Nitro')"
      :description="
        text(
          'Additional amount displayed per item for buyers without Nitro.',
          'จำนวนเงินเพิ่มต่อชิ้นที่แสดงสำหรับผู้ซื้อไม่มี Nitro',
        )
      "
      compact
    >
      <FeatureConfigField field-key="PRICE_READER_NO_NITRO_MARKUP_SATANG" />
    </FeatureSettingsCard>
  </div>
</template>
