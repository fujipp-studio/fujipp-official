<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{ modelValue: string; multiline?: boolean; placeholder?: string; addLabel?: string }>(),
  { multiline: false, placeholder: '', addLabel: 'เพิ่มรายการ' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const items = computed(() => (props.modelValue === '' ? [] : props.modelValue.split('\n')))
function commit(next: string[]) {
  emit('update:modelValue', next.join('\n'))
}
function update(index: number, value: string) {
  const next = [...items.value]
  next[index] = value
  commit(next)
}
function add() {
  commit([...items.value, ''])
}
function remove(index: number) {
  commit(items.value.filter((_, itemIndex) => itemIndex !== index))
}
</script>

<template>
  <div class="mt-xs space-y-xs">
    <div
      v-for="(item, index) in items"
      :key="index"
      class="grid grid-cols-[minmax(0,1fr)_2.5rem] items-start gap-xs"
    >
      <textarea
        v-if="multiline"
        :value="item"
        class="field-control min-h-20 resize-y py-sm"
        rows="2"
        :placeholder="placeholder"
        @input="update(index, ($event.target as HTMLTextAreaElement).value)"
      />
      <input
        v-else
        :value="item"
        class="field-control h-11"
        :placeholder="placeholder"
        @input="update(index, ($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-error-border text-error-text hover:bg-error-bg"
        :aria-label="`ลบรายการ ${index + 1}`"
        @click="remove(index)"
      ><Trash2 :size="17" /></button>
    </div>
    <button
      type="button"
      class="inline-flex items-center gap-xs rounded-md border border-border-default px-sm py-xs text-sm hover:bg-bg-surface-hover"
      @click="add"
    ><Plus :size="16" /> {{ addLabel }}</button>
  </div>
</template>
