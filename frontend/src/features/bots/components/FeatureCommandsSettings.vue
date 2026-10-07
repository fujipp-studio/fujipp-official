<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Terminal } from 'lucide-vue-next'
import { AppTextField } from '@/shared/ui'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureCommandList from './FeatureCommandList.vue'
import type { FeatureSubcommand } from '../config/feature-commands'

const props = defineProps<{
  modelValue: string
  defaultName: string
  required?: boolean
  commands: readonly FeatureSubcommand[]
  description?: string
  permissionNote?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { locale } = useI18n()
const text = (en: string, th: string) => (locale.value === 'th' ? th : en)
const id = useId()
const error = computed(() =>
  !/^[a-z0-9_-]{1,32}$/.test(props.modelValue)
    ? text(
        'Use 1–32 lowercase letters, numbers, _ or -, without /.',
        'ใช้ a–z, ตัวเลข, _ หรือ - จำนวน 1–32 ตัว โดยไม่ใส่ /',
      )
    : '',
)
const commandName = computed(() => props.modelValue.trim().toLowerCase() || props.defaultName)
</script>

<template>
  <FeatureSettingsCard
    :heading-id="id + '-heading'"
    :title="text('Commands', 'คำสั่ง')"
    :description="
      description ||
      text(
        'Set the command name and see the available subcommands.',
        'ตั้งชื่อคำสั่งและดูคำสั่งย่อยที่ใช้งานได้',
      )
    "
    :icon="Terminal"
    data-feature-commands
  >
    <AppTextField
      :model-value="modelValue"
      :label="text('Command name', 'ชื่อคำสั่ง')"
      unit="/"
      :placeholder="defaultName"
      :maxlength="32"
      pattern="[a-z0-9_-]{1,32}"
      :required="required"
      :state="error ? 'error' : 'default'"
      :support-text="
        error ||
        text('Do not include / · up to 32 characters.', 'ไม่ต้องใส่ / · สูงสุด 32 ตัวอักษร')
      "
      @update:model-value="emit('update:modelValue', $event)"
    />
    <h3 v-if="commands.length" :id="id + '-subcommands'" class="mt-lg text-sm font-medium">
      {{ text('Available subcommands', 'คำสั่งย่อยที่ใช้งานได้') }}
    </h3>
    <FeatureCommandList
      v-if="commands.length"
      class="mt-sm"
      :labelledby="id + '-subcommands'"
      :commands="
        commands.map((command) => ({ ...command, name: commandName + '/' + command.name }))
      "
    />
    <slot />
    <p class="mt-lg border-t border-border-subtle pt-md text-xs text-text-muted">
      {{
        permissionNote ||
        text(
          'Administrators can use these commands by default. Allow other roles or users in Bot Permissions.',
          'ค่าเริ่มต้นให้ Administrator ใช้คำสั่ง กำหนด Role หรือผู้ใช้อื่นได้ใน Bot Permissions',
        )
      }}
    </p>
  </FeatureSettingsCard>
</template>
