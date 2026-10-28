<script setup lang="ts">
import { ref } from 'vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
const props = defineProps<{
  options: Array<{ value: string; label: string }>
  disabled?: boolean
}>()
const emit = defineEmits<{ select: [action: string] }>()
const { text } = useFeatureEditor()
const menu = ref<HTMLDetailsElement>()
function choose(action: string) {
  if (props.disabled) return
  emit('select', action)
  if (menu.value) menu.value.open = false
}
</script>

<template>
  <details v-if="options.length" ref="menu" class="min-w-0" data-feature-button-picker>
    <summary
      class="builder-add cursor-pointer"
      :aria-disabled="disabled"
      :tabindex="disabled ? -1 : 0"
      @click="disabled && $event.preventDefault()"
    >
      + {{ text('Feature button', 'ปุ่ม Feature') }}
    </summary>
    <div
      class="mt-xs flex flex-wrap gap-xs rounded-lg border border-border-subtle bg-bg-default p-sm"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="builder-add"
        :disabled="disabled"
        @click="choose(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </details>
</template>
