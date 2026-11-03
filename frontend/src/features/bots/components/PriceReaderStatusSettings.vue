<script setup lang="ts">
import { computed, ref } from 'vue'
import { MessageSquare } from 'lucide-vue-next'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppModal from '@/shared/ui/dialogs/AppModal.vue'
import { countedItemTemplate, countedErrorTemplate, localizedCountedConfig, priceTextVariables } from '@price-reader/counted-text'
import PriceReaderTemplateField from './PriceReaderTemplateField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { text, values, configuration, license, presentations, presentationJson, advancedSlots } = useFeatureEditor()
const resetOpen = ref(false)
function reset() {
  values.value.PRICE_READER_RESULTS_ITEM_TEMPLATE = countedItemTemplate
  values.value.PRICE_READER_ERROR_ITEM_TEMPLATE = countedErrorTemplate
  values.value.PRICE_READER_RESULT_MODE = 'TEMPLATE'
  for (const key of ['PRICE_READER_NOT_FOUND_TEXT', 'PRICE_READER_OCR_ERROR_TEXT', 'PRICE_READER_UNMATCHED_PRICE_TEXT', 'PRICE_READER_BOTH_DISCORD_TEMPLATE', 'PRICE_READER_BOTH_SHOP_TEMPLATE', 'PRICE_READER_MISSING_PRICE_TEXT'])
    if (field(key)) values.value[key] = '{{default}}'
  for (const slot of configuration.value?.presentations ?? []) {
    presentations.value[slot.key] = JSON.parse(JSON.stringify(slot.defaultDefinition))
    presentationJson.value[slot.key] = JSON.stringify(slot.defaultDefinition, null, 2)
    advancedSlots.value.delete(slot.key)
  }
  resetOpen.value = false
}
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const value = (key: string) => String(values.value[key] ?? '')
const defaults = computed(() => localizedCountedConfig({ PRICE_READER_LANGUAGE: values.value.PRICE_READER_LANGUAGE }))
const statusFields = computed(() =>
  [
    { key: 'PRICE_READER_BOTH_DISCORD_TEMPLATE', label: text('Discord prices · Both mode', 'รูปแบบราคา Discord · ทั้งสองแบบ'), variables: priceTextVariables.filter(key => !key.includes('shop')) },
    { key: 'PRICE_READER_BOTH_SHOP_TEMPLATE', label: text('Shop prices · Both mode', 'รูปแบบราคารับกด · ทั้งสองแบบ'), variables: priceTextVariables.filter(key => key.includes('shop') || key.endsWith('label')) },
    { key: 'PRICE_READER_MISSING_PRICE_TEXT', label: text('Price not visible', 'ข้อความเมื่อไม่พบราคาในรูป'), variables: [] },
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
    <p v-if="field('PRICE_READER_BOTH_DISCORD_TEMPLATE')" class="mb-lg text-sm text-text-secondary" data-price-text-settings>{{ text('Customize price labels, order and line breaks here. Edit the image template in Result text for Markdown and custom units.', 'แก้ป้ายราคา ลำดับ และบรรทัดที่นี่ ส่วน Markdown และหน่วยเงิน แก้รูปแบบต่อรูปในข้อความผลลัพธ์') }}</p>
    <div class="space-y-lg">
      <div v-for="item in statusFields" :key="item.key" class="space-y-sm" :data-price-format-key="item.key">
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
          @click="values[item.key] = String(defaults[item.key] ?? '')"
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
    <AppButton v-if="license?.version === '3.2.0'" variant="secondary" class="mt-lg !w-auto" @click="resetOpen = true">{{ text('Reset standard messages', 'รีเซ็ตข้อความมาตรฐาน') }}</AppButton>
    <AppModal :open="resetOpen" :title="text('Reset standard messages?', 'รีเซ็ตข้อความมาตรฐาน?')" @update:open="resetOpen = $event" @close="resetOpen = false">
      <p>{{ text('Replace all text and message designs with defaults? Save all to apply.', 'แทนที่ข้อความและดีไซน์ทั้งหมดด้วยค่าเริ่มต้น? บันทึกทั้งหมดเพื่อใช้จริง') }}</p>
      <template #actions>
        <AppButton variant="secondary" @click="resetOpen = false">{{ text('Cancel', 'ยกเลิก') }}</AppButton>
        <AppButton @click="reset">{{ text('Apply to draft', 'ใช้กับฉบับแก้ไข') }}</AppButton>
      </template>
    </AppModal>
  </FeatureSettingsCard>
</template>
