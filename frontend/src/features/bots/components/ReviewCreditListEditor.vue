<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import { AppTextArea, AppTextField } from '@/shared/ui'
import { parseReviewList } from '../config/review-credit'

const props = defineProps<{
  modelValue: string
  multiline?: boolean
  limit: number
  maxlength: number
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { locale } = useI18n()
const text = (en: string, th: string) => (locale.value === 'th' ? th : en)
const list = ref<HTMLElement>()
const items = ref<string[]>([])
let emitted: string | undefined
watch(
  () => props.modelValue,
  (value) => {
    if (value !== emitted) items.value = parseReviewList(value)
  },
  { immediate: true },
)
function commit(next: string[]) {
  items.value = next
  emitted = JSON.stringify(next.map((item) => item.trim()).filter(Boolean))
  emit('update:modelValue', emitted)
}
function update(index: number, value: string) {
  const next = [...items.value]
  next[index] = value
  commit(next)
}
async function add() {
  if (items.value.length >= props.limit) return
  commit([...items.value, ''])
  await nextTick()
  list.value
    ?.querySelectorAll<HTMLElement>('input, textarea')
    .item(items.value.length - 1)
    ?.focus()
}
async function remove(index: number) {
  commit(items.value.filter((_, current) => current !== index))
  await nextTick()
  const fields = list.value?.querySelectorAll<HTMLElement>('input, textarea')
  if (fields?.length) fields.item(Math.min(index, fields.length - 1))?.focus()
  else list.value?.querySelector<HTMLElement>('[data-add-item]')?.focus()
}
</script>

<template>
  <div ref="list" class="mt-md space-y-md">
    <div v-for="(item, index) in items" :key="index" class="flex min-w-0 items-start gap-xs">
      <component
        :is="multiline ? AppTextArea : AppTextField"
        :model-value="item"
        :label="
          multiline
            ? text(`Reply ${index + 1}`, `ข้อความตอบกลับ ${index + 1}`)
            : text(`Reaction ${index + 1}`, `Reaction ${index + 1}`)
        "
        :placeholder="
          multiline ? text('Thank you for your review 💖', 'ขอบคุณสำหรับรีวิวครับ 💖') : '💖'
        "
        :maxlength="maxlength"
        :support-text="
          multiline ? `${item.length.toLocaleString()} / ${maxlength.toLocaleString()}` : undefined
        "
        :rows="3"
        class="min-w-0 flex-1"
        @update:model-value="update(index, $event)"
      />
      <button
        type="button"
        class="mt-lg inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-error-bg hover:text-error-text"
        :aria-label="
          multiline
            ? text(`Delete reply ${index + 1}`, `ลบข้อความตอบกลับ ${index + 1}`)
            : text(`Delete reaction ${index + 1}`, `ลบ Reaction ${index + 1}`)
        "
        @click="remove(index)"
      >
        <Trash2 :size="16" aria-hidden="true" />
      </button>
    </div>
    <p
      v-if="!items.length"
      class="rounded-lg border border-dashed border-border-default p-md text-sm text-text-muted"
    >
      {{
        multiline
          ? text('No automatic replies.', 'ยังไม่มีข้อความตอบกลับอัตโนมัติ')
          : text('No automatic reactions.', 'ยังไม่มี Reaction อัตโนมัติ')
      }}
    </p>
    <div class="flex items-center justify-between gap-sm">
      <button
        type="button"
        data-add-item
        :disabled="items.length >= limit"
        class="inline-flex items-center gap-xs rounded-md border border-border-default px-sm py-xs text-sm hover:bg-bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        @click="add"
      >
        <Plus :size="16" aria-hidden="true" />{{
          multiline
            ? text('Add reply', 'เพิ่มข้อความตอบกลับ')
            : text('Add reaction', 'เพิ่ม Reaction')
        }}
      </button>
      <span class="text-xs text-text-muted">{{ items.length }} / {{ limit }}</span>
    </div>
  </div>
</template>

<style scoped>
button:focus-visible {
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 2px;
}
</style>
