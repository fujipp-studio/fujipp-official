<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { text } = useFeatureEditor()
const list = ref<HTMLElement>()
const entries = computed(() => {
  try {
    const parsed: unknown = JSON.parse(props.modelValue)
    return Array.isArray(parsed) &&
      parsed.every((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
      ? (parsed as Record<string, unknown>[])
      : null
  } catch {
    return null
  }
})
function update(index: number, key: string, value: string) {
  const next = entries.value?.map((item) => ({ ...item }))
  if (!next?.[index]) return
  next[index][key] = key === 'thresholdBaht' ? (value === '' ? '' : Number(value)) : value
  emit('update:modelValue', JSON.stringify(next))
}
async function add() {
  if (!entries.value) return
  emit('update:modelValue', JSON.stringify([...entries.value, { thresholdBaht: 1000, roleId: '' }]))
  await nextTick()
  list.value
    ?.querySelectorAll<HTMLInputElement>('input[type="number"]')
    .item(entries.value.length - 1)
    ?.focus()
}
async function remove(index: number) {
  emit('update:modelValue', JSON.stringify(entries.value?.filter((_, i) => i !== index)))
  await nextTick()
  const inputs = list.value?.querySelectorAll<HTMLInputElement>('input[type="number"]')
  if (inputs?.length) inputs.item(Math.min(index, inputs.length - 1))?.focus()
  else list.value?.querySelector<HTMLButtonElement>('[data-add-milestone]')?.focus()
}
</script>

<template>
  <div ref="list" class="space-y-md">
    <label v-if="entries === null" class="block text-sm text-error-text">
      {{
        text(
          'Could not read milestones. Correct the saved JSON.',
          'อ่านข้อมูลเกณฑ์ไม่ได้ กรุณาแก้ไข JSON เดิม',
        )
      }}
      <textarea
        :value="modelValue"
        class="field-control mt-sm min-h-32 font-mono"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
    <template v-else>
      <fieldset
        v-for="(entry, index) in entries"
        :key="index"
        class="min-w-0 border-t border-border-subtle pt-md"
      >
        <legend class="sr-only">{{ text(`Milestone ${index + 1}`, `เกณฑ์ ${index + 1}`) }}</legend>
        <div class="mb-sm flex items-center justify-between gap-sm">
          <span class="text-sm text-text-secondary">{{
            text(`Milestone ${index + 1}`, `เกณฑ์ ${index + 1}`)
          }}</span>
          <button
            type="button"
            class="rounded-md p-xs text-text-muted hover:bg-error-bg hover:text-error-text"
            :aria-label="text(`Delete milestone ${index + 1}`, `ลบเกณฑ์ ${index + 1}`)"
            @click="remove(index)"
          >
            <Trash2 :size="18" aria-hidden="true" />
          </button>
        </div>
        <div class="grid gap-md tablet:grid-cols-2">
          <AppTextField
            :model-value="String(entry.thresholdBaht ?? entry.threshold ?? '')"
            :label="text('Minimum lifetime top-up (THB)', 'ยอดเติมสะสมขั้นต่ำ (บาท)')"
            input-type="number"
            :min="0.01"
            :step="0.01"
            placeholder="1000"
            required
            @update:model-value="update(index, 'thresholdBaht', $event)"
          />
          <AppTextField
            :model-value="String(entry.roleId ?? '')"
            label="Discord Role ID"
            placeholder="123456789012345678"
            pattern="[0-9]{15,30}"
            required
            @update:model-value="update(index, 'roleId', $event)"
          />
        </div>
      </fieldset>
      <p
        v-if="!entries.length"
        class="rounded-lg border border-dashed border-border-default p-md text-sm text-text-muted"
      >
        {{ text('No milestone roles configured.', 'ยังไม่ได้กำหนดยศตามยอดเติมสะสม') }}
      </p>
      <button
        type="button"
        data-add-milestone
        class="inline-flex items-center gap-xs rounded-md border border-border-default px-sm py-xs text-sm hover:bg-bg-surface-hover"
        @click="add"
      >
        <Plus :size="16" aria-hidden="true" />{{ text('Add milestone', 'เพิ่มเกณฑ์') }}
      </button>
    </template>
  </div>
</template>
