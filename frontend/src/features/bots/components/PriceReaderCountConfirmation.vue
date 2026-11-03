<script setup lang="ts">
import { computed } from 'vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
const props = defineProps<{ rawText: string; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const selected = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const { text } = useFeatureEditor()
const options = computed(() => [
  ...(JSON.parse(props.rawText).itemType === 'BUNDLE'
    ? []
    : [{ value: '1', label: text('Single item', 'ชิ้นเดียว') }]),
  ...[2, 3, 4, 5].map((count) => ({
    value: String(count),
    label: text(`Bundle · ${count} items`, `บันเดิล ${count} ชิ้น`),
  })),
])
</script>
<template>
  <FeatureSettingsCard :title="text('Choose included item count', 'เลือกจำนวนสินค้าที่รวมอยู่')">
    <AppTextField
      v-model="selected"
      :label="text('Number of included items', 'จำนวนสินค้าที่รวมอยู่')"
      variant="dropdown"
      :options="options"
    />
    <p class="mt-sm text-sm text-text-secondary">
      {{
        text(
          'The image does not show a clear count. Choose before quoting; Discord asks the sender the same question.',
          'รูปยังระบุจำนวนชิ้นไม่ชัด เลือกก่อนแสดงราคา บอทใน Discord จะถามผู้ส่งเช่นเดียวกัน',
        )
      }}
    </p>
  </FeatureSettingsCard>
</template>
