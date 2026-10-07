<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppTextField, type TextFieldOption } from '@/shared/ui'
import type { PermissionCommandFeature } from '../config/permission-commands'

const props = defineProps<{ modelValue: string; features: PermissionCommandFeature[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { locale } = useI18n()
const text = (en: string, th: string) => (locale.value === 'th' ? th : en)
const id = useId()
const selection = ref<string | null>(null)
const normalized = computed(() =>
  props.modelValue.trim().toLowerCase().replace(/^\//, '').replace(/\s+/g, '/'),
)
const featureId = computed(
  () =>
    selection.value ??
    (!normalized.value
      ? '@choose'
      : normalized.value === '*'
        ? '*'
        : (props.features.find((item) =>
            item.commands.some((command) => command.value === normalized.value),
          )?.id ?? '')),
)
const feature = computed(() => props.features.find((item) => item.id === featureId.value))
const command = computed(() =>
  feature.value?.commands.find((item) => item.value === normalized.value),
)
const featureOptions = computed<TextFieldOption[]>(() => [
  { value: '@choose', label: text('Choose a Feature', 'เลือก Feature'), disabled: true },
  { value: '@custom', label: text('Custom command', 'กำหนดคำสั่งเอง') },
  ...props.features.map((item) => ({
    value: item.id,
    label: item.name + (item.unavailable ? text(' (unavailable)', ' (โหลดคำสั่งไม่ได้)') : ''),
    disabled: item.unavailable,
  })),
  { value: '*', label: text('All commands (*)', 'ทุกคำสั่ง (*)') },
])
const commandOptions = computed<TextFieldOption[]>(() =>
  (feature.value?.commands ?? []).map((item) => ({
    value: item.value,
    label: '/' + item.value.replaceAll('/', ' '),
  })),
)
watch(normalized, (value) => {
  if (selection.value && value !== '*' && !command.value) selection.value = null
})
function selectFeature(value: string) {
  selection.value = value === '@custom' ? '' : value
  if (selection.value === '*') emit('update:modelValue', '*')
}
</script>

<template>
  <div class="grid min-w-0 gap-md tablet:grid-cols-2">
    <div class="min-w-0">
      <AppTextField
        variant="dropdown"
        label="Feature"
        :model-value="featureId === '' ? '@custom' : featureId"
        :options="featureOptions"
        :placeholder="text('Choose a Feature', 'เลือก Feature')"
        @update:model-value="selectFeature"
      />
    </div>
    <div v-if="feature" class="min-w-0">
      <AppTextField
        variant="dropdown"
        :label="text('Command', 'คำสั่ง')"
        :model-value="command?.value ?? ''"
        :options="commandOptions"
        :placeholder="text('Choose a command', 'เลือกคำสั่ง')"
        :support-text="
          command
            ? locale === 'th'
              ? command.description.th
              : command.description.en
            : text('Choose a command to apply this rule.', 'เลือกคำสั่งที่จะใช้กฎนี้')
        "
        required
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>
    <div v-else-if="featureId === '*'" class="min-w-0 self-end">
      <p
        class="rounded-md border border-border-subtle bg-bg-surface p-sm text-xs text-text-secondary"
      >
        {{
          text(
            'Applies to commands without a more specific rule.',
            'ใช้กับคำสั่งที่ไม่มีกฎเฉพาะเจาะจงกว่า',
          )
        }}
      </p>
    </div>
    <div v-else-if="featureId === ''" class="min-w-0">
      <label :for="id + '-custom'" class="block text-sm font-medium">Command / Subcommand</label>
      <input
        :id="id + '-custom'"
        :value="modelValue"
        data-command-input
        class="field-control mt-xs h-11 font-mono"
        maxlength="80"
        required
        :placeholder="text('e.g. spending/add or *', 'เช่น spending/add หรือ *')"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
  <p v-if="!features.length && featureId !== '*'" class="mt-xs text-xs text-text-muted">
    {{
      text(
        'If suggestions are unavailable, enter the command manually.',
        'หากไม่มีคำสั่งแนะนำ สามารถเลือกกำหนดคำสั่งเองได้',
      )
    }}
  </p>
</template>
