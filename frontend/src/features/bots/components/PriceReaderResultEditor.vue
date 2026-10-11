<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-vue-next'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppToggle from '@/shared/ui/buttons/AppToggle.vue'
import PriceReaderTemplateField from './PriceReaderTemplateField.vue'
import { itemVariables, type ResultBlock } from '@price-reader/results'

const props = defineProps<{
  modelValue: string
  template: string
  withMarkup: boolean
  canUseBlocks: boolean
  mode?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:template': [value: string]
  'update:mode': [value: string]
}>()
const { locale } = useI18n()
const text = (en: string, th: string) => (locale.value === 'th' ? th : en)
const help = computed(() =>
  text(
    'Use {{results_text}} in Message design to display the image results.',
    'ใส่ {{results_text}} ในส่วนออกแบบข้อความ เพื่อแสดงผลลัพธ์แต่ละรูป',
  ),
)
const parsed = computed<unknown>(() => {
  try {
    return JSON.parse(props.modelValue || '[]')
  } catch {
    return null
  }
})
const valid = computed(
  () =>
    Array.isArray(parsed.value) &&
    parsed.value.every(
      (block) =>
        block &&
        typeof block === 'object' &&
        typeof block.id === 'string' &&
        typeof block.enabled === 'boolean' &&
        typeof block.text === 'string',
    ),
)
const blocks = computed(() => (valid.value ? (parsed.value as ResultBlock[]) : []))
const visual = computed(
  () =>
    props.canUseBlocks &&
    valid.value &&
    (props.mode === 'BLOCKS' || (props.mode === undefined && blocks.value.length > 0)),
)
const variables = computed(() => [
  ...itemVariables,
  ...(props.withMarkup ? ['no_nitro_markup'] : []),
])
function commit(next: ResultBlock[]) {
  emit('update:modelValue', JSON.stringify(next, null, 2))
}
function enableVisual() {
  emit('update:mode', 'BLOCKS')
  if (blocks.value.length) return
  commit([
    { id: 'index', enabled: true, text: '### รูปที่ {{result_index}}' },
    { id: 'name', enabled: false, text: '**{{item_name}}**' },
    {
      id: 'discord',
      enabled: true,
      text:
        '💙 **ราคาดิสคอร์ด**\n`{{discord_price}} บาท`' +
        (props.withMarkup ? '{{discount_text}}' : ''),
    },
    { id: 'shop', enabled: true, text: '💗 **ราคาร้านขาย**\n`{{shop_price_text}}`' },
    ...(props.withMarkup
      ? [
          {
            id: 'markup',
            enabled: true,
            text: '💛 **ราคาไม่มีไนโตร บวกชิ้นละ**\n`{{no_nitro_markup}} บาท`',
          },
        ]
      : []),
  ])
}
function enableTemplate() {
  if (props.mode === undefined) commit([])
  emit('update:mode', 'TEMPLATE')
}
function update(index: number, patch: Partial<ResultBlock>) {
  commit(blocks.value.map((block, i) => (i === index ? { ...block, ...patch } : block)))
}
function move(index: number, direction: number) {
  const next = [...blocks.value]
  const block = next.splice(index, 1)[0]
  if (!block) return
  next.splice(index + direction, 0, block)
  commit(next)
}
function addBlock() {
  commit([...blocks.value, { id: crypto.randomUUID(), enabled: true, text: '' }])
}
</script>

<template>
  <div class="space-y-lg" data-price-result-editor>
    <div v-if="canUseBlocks && valid" class="flex flex-wrap gap-sm">
      <AppButton
        :variant="visual ? 'primary' : 'secondary'"
        :aria-pressed="visual"
        class="!w-auto"
        @click="!visual && enableVisual()"
      >
        {{ text('Design with blocks', 'ออกแบบด้วยบล็อก') }}
      </AppButton>
      <AppButton
        :variant="!visual ? 'primary' : 'secondary'"
        :aria-pressed="!visual"
        class="!w-auto"
        @click="enableTemplate"
      >
        {{ text('Use template', 'ใช้ Template') }}
      </AppButton>
    </div>
    <template v-if="!valid">
      <PriceReaderTemplateField
        :model-value="modelValue"
        :label="text('Result blocks JSON', 'JSON บล็อกผลลัพธ์')"
        @update:model-value="emit('update:modelValue', $event)"
      />
      <p class="text-sm text-error-text">
        {{
          text(
            'Fix the block list to return to the visual editor.',
            'แก้รายการบล็อกให้ถูกต้องเพื่อกลับไปใช้ตัวออกแบบ',
          )
        }}
      </p>
    </template>
    <template v-else-if="visual">
      <p class="text-sm text-text-secondary">
        {{
          text(
            'Enable, edit and reorder the information shown for each image. Your template is kept separately.',
            'เปิดปิด แก้ข้อความ และย้ายลำดับข้อมูลของแต่ละรูป ระบบเก็บ Template เดิมไว้ให้',
          )
        }}
      </p>
      <article
        v-for="(block, index) in blocks"
        :key="block.id"
        class="min-w-0 space-y-md rounded-lg border border-border-subtle bg-bg-default p-md"
        data-result-block
      >
        <div class="flex flex-wrap items-center justify-between gap-sm">
          <AppToggle
            :model-value="block.enabled"
            :label="text(`Show block ${index + 1}`, `แสดงบล็อกที่ ${index + 1}`)"
            @change="update(index, { enabled: $event })"
          />
          <div class="flex gap-xs">
            <AppButton
              variant="secondary"
              class="!w-auto"
              :disabled="index === 0"
              :aria-label="text(`Move block ${index + 1} up`, `ย้ายบล็อกที่ ${index + 1} ขึ้น`)"
              @click="move(index, -1)"
              ><ArrowUp :size="16"
            /></AppButton>
            <AppButton
              variant="secondary"
              class="!w-auto"
              :disabled="index === blocks.length - 1"
              :aria-label="text(`Move block ${index + 1} down`, `ย้ายบล็อกที่ ${index + 1} ลง`)"
              @click="move(index, 1)"
              ><ArrowDown :size="16"
            /></AppButton>
            <AppButton
              variant="secondary"
              class="!w-auto"
              :disabled="blocks.length === 1"
              :aria-label="text(`Delete block ${index + 1}`, `ลบบล็อกที่ ${index + 1}`)"
              @click="commit(blocks.filter((_, i) => i !== index))"
              ><Trash2 :size="16"
            /></AppButton>
          </div>
        </div>
        <PriceReaderTemplateField
          :model-value="block.text"
          :label="text(`Block ${index + 1} text`, `ข้อความบล็อกที่ ${index + 1}`)"
          :required="block.enabled"
          :maxlength="1000"
          :variables="variables"
          :rows="3"
          @update:model-value="update(index, { text: $event })"
        />
      </article>
      <p
        v-if="!blocks.some((block) => block.enabled && block.text.trim())"
        role="alert"
        class="text-sm text-error-text"
      >
        {{
          text('Enable at least one block with text.', 'เปิดใช้งานอย่างน้อยหนึ่งบล็อกที่มีข้อความ')
        }}
      </p>
      <AppButton
        variant="secondary"
        class="!w-auto"
        :disabled="blocks.length >= 12"
        @click="addBlock"
        ><Plus :size="16" />{{ text('Add block', 'เพิ่มบล็อก') }}</AppButton
      >
    </template>
    <PriceReaderTemplateField
      v-else
      :model-value="template"
      :label="text('Result item template', 'รูปแบบผลลัพธ์ต่อรูป')"
      :variables="variables"
      :rows="8"
      @update:model-value="emit('update:template', $event)"
    />
    <p class="text-xs text-text-muted">{{ help }}</p>
  </div>
</template>
