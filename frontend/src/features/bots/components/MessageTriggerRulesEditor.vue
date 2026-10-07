<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import { parseMessageTriggerRules } from '../config/channel-message-triggers'

const props = withDefaults(
  defineProps<{
    modelValue: string
    kind: 'channel-create' | 'admin-message'
    templates: Array<{ value: string; label: string }>
    limit?: number
  }>(),
  { limit: 25 },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { locale } = useI18n()
const text = (en: string, th: string) => (locale.value === 'th' ? th : en)
const list = ref<HTMLElement>()
const rules = computed(() => parseMessageTriggerRules(props.modelValue))
const targetKey = computed(() => (props.kind === 'channel-create' ? 'categoryId' : 'trigger'))
const target = (rule: Record<string, unknown>) => String(rule[targetKey.value] ?? '')
const template = (rule: Record<string, unknown>) => String(rule.template ?? '')
const normalizedTarget = (rule: Record<string, unknown>) =>
  target(rule).trim().toLocaleLowerCase('en-US')
function targetError(rule: Record<string, unknown>) {
  if (props.kind === 'channel-create')
    return /^\d{15,30}$/.test(target(rule))
      ? ''
      : text(
          'Enter a Discord Category ID with 15–30 digits.',
          'กรอก Category ID เป็นตัวเลข 15–30 หลัก',
        )
  return target(rule).trim().length > 0 && target(rule).length <= 100
    ? ''
    : text('Enter a trigger of 1–100 characters.', 'กรอกข้อความ Trigger 1–100 ตัวอักษร')
}
function templateError(rule: Record<string, unknown>) {
  return props.templates.some((item) => item.value === template(rule))
    ? ''
    : text('Choose an available message template.', 'เลือก Template ที่มีอยู่')
}
function duplicate(rule: Record<string, unknown>, index: number) {
  const value = normalizedTarget(rule)
  return value && rules.value.slice(0, index).some((item) => normalizedTarget(item) === value)
}
function commit(value: Record<string, unknown>[]) {
  emit('update:modelValue', JSON.stringify(value, null, 2))
}
function update(index: number, key: string, value: string) {
  const next = rules.value.map((rule) => ({ ...rule }))
  if (!next[index]) return
  next[index][key] = value
  commit(next)
}
async function add() {
  if (rules.value.length >= props.limit || !props.templates.length) return
  commit([...rules.value, { [targetKey.value]: '', template: props.templates[0]!.value }])
  await nextTick()
  list.value
    ?.querySelectorAll<HTMLInputElement>('[data-trigger-rule] input')
    .item(rules.value.length - 1)
    ?.focus()
}
async function remove(index: number) {
  commit(rules.value.filter((_, current) => current !== index))
  await nextTick()
  const fields = list.value?.querySelectorAll<HTMLInputElement>('[data-trigger-rule] input')
  if (fields?.length) fields.item(Math.min(index, fields.length - 1))?.focus()
  else list.value?.querySelector<HTMLButtonElement>('[data-add-trigger]')?.focus()
}
</script>

<template>
  <div ref="list" class="trigger-editor space-y-md">
    <p
      v-if="!rules.length"
      class="rounded-lg border border-dashed border-border-default p-lg text-center text-sm text-text-muted"
    >
      {{
        kind === 'channel-create'
          ? text('No channel creation rules yet.', 'ยังไม่มีกฎเมื่อสร้างห้อง')
          : text('No administrator triggers yet.', 'ยังไม่มี Trigger สำหรับแอดมิน')
      }}
    </p>
    <article
      v-for="(rule, index) in rules"
      :key="index"
      class="min-w-0 rounded-lg border border-border-subtle bg-bg-default p-md"
      data-trigger-rule
    >
      <header class="mb-md flex items-center justify-between gap-sm">
        <h3 class="text-sm font-semibold">{{ text(`Rule ${index + 1}`, `กฎ ${index + 1}`) }}</h3>
        <AppButton
          variant="secondary"
          class="!h-10 !w-10 !shrink-0 !px-0 hover:!bg-error-bg hover:!text-error-text"
          :aria-label="text(`Delete rule ${index + 1}`, `ลบกฎ ${index + 1}`)"
          @click="remove(index)"
        >
          <Trash2 :size="16" aria-hidden="true" />
        </AppButton>
      </header>
      <div class="grid min-w-0 gap-md tablet:grid-cols-2">
        <AppTextField
          :model-value="target(rule)"
          :label="
            kind === 'channel-create'
              ? 'Discord Category ID'
              : text('Trigger text', 'ข้อความ Trigger')
          "
          :placeholder="kind === 'channel-create' ? '123456789012345678' : 'pay'"
          :maxlength="kind === 'channel-create' ? 30 : 100"
          :pattern="kind === 'channel-create' ? '[0-9]{15,30}' : undefined"
          required
          :state="targetError(rule) ? 'error' : 'default'"
          :support-text="
            targetError(rule) || (kind === 'admin-message' ? `${target(rule).length} / 100` : '')
          "
          @update:model-value="update(index, targetKey, $event)"
        />
        <AppTextField
          variant="dropdown"
          :model-value="template(rule)"
          :label="text(`Message template for rule ${index + 1}`, `Template สำหรับกฎ ${index + 1}`)"
          :placeholder="text('Choose a template', 'เลือก Template')"
          :options="templates"
          required
          :state="templateError(rule) ? 'error' : 'default'"
          :support-text="templateError(rule)"
          @update:model-value="update(index, 'template', $event)"
        />
      </div>
      <p v-if="duplicate(rule, index)" class="mt-sm text-xs text-warning-text" role="status">
        {{
          text(
            'This target is already used above. The bot uses the first matching rule.',
            'เงื่อนไขนี้ซ้ำกับกฎด้านบน บอทจะใช้กฎแรกที่ตรงเงื่อนไข',
          )
        }}
      </p>
    </article>
    <div class="flex flex-wrap items-center justify-between gap-sm">
      <AppButton
        data-add-trigger
        class="!w-auto"
        variant="secondary"
        :disabled="rules.length >= limit || !templates.length"
        @click="add"
      >
        <Plus :size="16" aria-hidden="true" />{{ text('Add rule', 'เพิ่มกฎ') }}
      </AppButton>
      <span class="text-xs text-text-muted">{{ rules.length }} / {{ limit }}</span>
    </div>
    <p v-if="!templates.length" class="text-xs text-text-muted">
      {{ text('No message templates are available.', 'ยังไม่มี Template ข้อความให้เลือก') }}
    </p>
  </div>
</template>
