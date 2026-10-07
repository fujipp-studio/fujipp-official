<script setup lang="ts">
import { computed } from 'vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'

const props = defineProps<{
  fieldKey: string
  label?: string
  supportText?: string
  unit?: string
}>()
const {
  configuration,
  values,
  secrets,
  fieldOptions,
  configFieldLabel,
  configFieldDescription,
  text,
} = useFeatureEditor()
const field = computed(() =>
  configuration.value?.fields.find((item) => item.key === props.fieldKey),
)
const raw = computed(() =>
  String(
    field.value?.secret
      ? (secrets.value[props.fieldKey] ?? '')
      : (values.value[props.fieldKey] ?? ''),
  ),
)
const numeric = computed(() => ['INTEGER', 'DECIMAL'].includes(field.value?.type ?? ''))
const satang = computed(() => props.fieldKey.endsWith('_SATANG'))
const minimum = computed(() =>
  typeof field.value?.validation?.minimum === 'number' ? field.value.validation.minimum : undefined,
)
const maximum = computed(() =>
  typeof field.value?.validation?.maximum === 'number' ? field.value.validation.maximum : undefined,
)
const exclusiveMinimum = computed(() =>
  typeof field.value?.validation?.exclusiveMinimum === 'number'
    ? field.value.validation.exclusiveMinimum
    : undefined,
)
const pattern = computed(() =>
  ['CHANNEL_ID', 'ROLE_ID', 'USER_ID'].includes(field.value?.type ?? '')
    ? '[0-9]{15,30}'
    : typeof field.value?.validation?.pattern === 'string'
      ? field.value.validation.pattern
      : undefined,
)
const error = computed(() => {
  if (!raw.value) return ''
  if (
    numeric.value &&
    (!Number.isFinite(Number(raw.value)) ||
      (field.value?.type === 'INTEGER' && !Number.isInteger(Number(raw.value))))
  )
    return field.value?.type === 'INTEGER'
      ? text('Enter a whole number.', 'กรอกจำนวนเต็ม')
      : text('Enter a valid number.', 'กรอกตัวเลขที่ถูกต้อง')
  if (
    numeric.value &&
    ((minimum.value != null && Number(raw.value) < minimum.value) ||
      (maximum.value != null && Number(raw.value) > maximum.value) ||
      (exclusiveMinimum.value != null && Number(raw.value) <= exclusiveMinimum.value))
  )
    return text('Enter a value within the allowed range.', 'กรอกค่าภายในช่วงที่กำหนด')
  if (pattern.value && !new RegExp('^(?:' + pattern.value + ')$').test(raw.value))
    return ['CHANNEL_ID', 'ROLE_ID', 'USER_ID'].includes(field.value?.type ?? '')
      ? text('Discord ID must have 15–30 digits.', 'Discord ID ต้องเป็นตัวเลข 15–30 หลัก')
      : text('Check the number format.', 'ตรวจสอบรูปแบบหมายเลข')
  return ''
})
const support = computed(() => {
  if (error.value) return error.value
  if (field.value?.secret)
    return field.value.configured
      ? text(
          'Saved · leave blank to keep the current value.',
          'บันทึกไว้แล้ว · เว้นว่างเพื่อใช้ค่าเดิม',
        )
      : text('Stored encrypted after saving.', 'ระบบจัดเก็บแบบเข้ารหัสเมื่อบันทึก')
  if (satang.value && raw.value !== '' && Number.isFinite(Number(raw.value)))
    return text(
      `Equals ${(Number(raw.value) / 100).toFixed(2)} THB · 100 satang = 1 THB`,
      `เท่ากับ ${(Number(raw.value) / 100).toFixed(2)} บาท · 100 สตางค์ = 1 บาท`,
    )
  return props.supportText ?? (field.value ? configFieldDescription(field.value) : '')
})
function update(value: string) {
  if (field.value?.secret) secrets.value[props.fieldKey] = value
  else values.value[props.fieldKey] = value
}
</script>

<template>
  <AppTextField
    v-if="field"
    :model-value="raw"
    :label="(label ?? configFieldLabel(field)) + (satang ? text(' (satang)', ' (สตางค์)') : '')"
    :unit="unit"
    :variant="field.secret ? 'secret' : fieldOptions(field).length ? 'dropdown' : 'text'"
    :input-type="numeric ? 'number' : 'text'"
    :options="fieldOptions(field)"
    :required="field.required && !(field.secret && field.configured)"
    :autocomplete="field.secret ? 'new-password' : undefined"
    :placeholder="field.secret ? text('Enter to replace', 'กรอกเพื่อเปลี่ยน') : ''"
    :pattern="pattern"
    :min="minimum"
    :max="maximum"
    :step="field.type === 'INTEGER' ? 1 : field.type === 'DECIMAL' ? 'any' : undefined"
    :maxlength="
      typeof field.validation?.maxLength === 'number' ? field.validation.maxLength : undefined
    "
    :state="error ? 'error' : 'default'"
    :support-text="support"
    @update:model-value="update"
  />
</template>
