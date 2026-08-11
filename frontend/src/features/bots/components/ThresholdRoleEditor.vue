<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'

type Entry = { amount?: number; thresholdBaht?: number; roleId: string }
const props = defineProps<{ modelValue: string; thresholdKey: 'amount' | 'thresholdBaht' }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { locale } = useI18n()
const text = (english: string, thai: string) => (locale.value === 'th' ? thai : english)
const showBlankDrafts = ref(false)
const entries = computed<Entry[]>(() => {
  try {
    const value = JSON.parse(props.modelValue)
    return Array.isArray(value)
      ? value.filter(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            (showBlankDrafts.value || String(entry.roleId ?? '').trim()),
        )
      : []
  } catch { return [] }
})
function commit(next: Entry[]) { emit('update:modelValue', JSON.stringify(next, null, 2)) }
function update(index: number, key: 'threshold' | 'roleId', value: string) {
  const next = entries.value.map((entry) => ({ ...entry }))
  const entry = next[index]
  if (!entry) return
  if (key === 'roleId') entry.roleId = value
  else entry[props.thresholdKey] = Math.max(0, Number(value) || 0)
  commit(next)
}
function add() {
  showBlankDrafts.value = true
  commit([...entries.value, { [props.thresholdKey]: 0, roleId: '' }])
}
function remove(index: number) { commit(entries.value.filter((_, i) => i !== index)) }
</script>

<template>
  <div class="mt-xs space-y-xs">
    <div class="hidden grid-cols-[10rem_minmax(0,1fr)_2.5rem] gap-xs px-xs text-xs text-text-muted tablet:grid">
      <span>{{ text('Minimum (THB)', 'ยอดขั้นต่ำ (บาท)') }}</span><span>{{ text('Discord role', 'ยศ Discord') }}</span><span />
    </div>
    <div v-for="(entry, index) in entries" :key="index" class="grid gap-xs tablet:grid-cols-[10rem_minmax(0,1fr)_2.5rem]">
      <input :value="entry[thresholdKey] ?? 0" type="number" min="0" step="0.01" class="field-control h-11" :placeholder="text('Minimum amount', 'ยอดขั้นต่ำ')" @input="update(index, 'threshold', ($event.target as HTMLInputElement).value)" />
      <input :value="entry.roleId" inputmode="numeric" pattern="[0-9]{15,30}" class="field-control h-11" :placeholder="text('Role ID', 'รหัสยศ')" @input="update(index, 'roleId', ($event.target as HTMLInputElement).value)" />
      <button type="button" class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-error-border text-error-text hover:bg-error-bg" :aria-label="text(`Delete level ${index + 1}`, `ลบระดับ ${index + 1}`)" @click="remove(index)"><Trash2 :size="17" /></button>
    </div>
    <p v-if="!entries.length" class="rounded-md border border-dashed border-border-subtle p-sm text-sm text-text-muted">
      {{ text('No milestone roles configured.', 'ยังไม่ได้ตั้งค่ายศตามยอดเติมสะสม') }}
    </p>
    <button type="button" class="inline-flex items-center gap-xs rounded-md border border-border-default px-sm py-xs text-sm hover:bg-bg-surface-hover" @click="add"><Plus :size="16" /> {{ text('Add level', 'เพิ่มระดับ') }}</button>
  </div>
</template>
