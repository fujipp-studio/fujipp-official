<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Crown, Plus, ShieldCheck, Trash2, UsersRound } from 'lucide-vue-next'
import { parseCommandPermissionRules, type CommandPermissionRule } from '../config/bot-permissions'
import type { PermissionCommandFeature } from '../config/permission-commands'
import PermissionCommandPicker from './PermissionCommandPicker.vue'

const props = defineProps<{
  modelValue: string
  hideSummary?: boolean
  hideAdminBadge?: boolean
  collapsible?: boolean
  commandFeatures?: PermissionCommandFeature[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { locale } = useI18n()
const text = (en: string, th: string) => (locale.value === 'th' ? th : en)
const id = useId()
const editor = ref<HTMLElement>()
const rules = computed(() => parseCommandPermissionRules(props.modelValue))
const drafts = ref<Array<{ roleIds: string; userIds: string }>>([])
const activeRule = ref<number | null>(0)
let lastEmitted: string | undefined
watch(
  () => props.modelValue,
  (value) => {
    if (value === lastEmitted) return
    drafts.value = (parseCommandPermissionRules(value) ?? []).map((rule) => ({
      roleIds: rule.roleIds.join(', '),
      userIds: rule.userIds.join(', '),
    }))
    activeRule.value = drafts.value.length
      ? Math.min(activeRule.value ?? 0, drafts.value.length - 1)
      : null
  },
  { immediate: true },
)
function commit(next: CommandPermissionRule[]) {
  lastEmitted = JSON.stringify(next, null, 2)
  emit('update:modelValue', lastEmitted)
}
const ids = (value: string) => value.split(/[\s,]+/).filter(Boolean)
const idError = (value: string) => ids(value).some((item) => !/^\d{15,30}$/.test(item))
function update(index: number, key: 'command' | 'roleIds' | 'userIds', value: string) {
  if (!rules.value) return
  const next = rules.value.map((rule) => ({
    ...rule,
    roleIds: [...rule.roleIds],
    userIds: [...rule.userIds],
  }))
  const rule = next[index]
  if (!rule) return
  if (key === 'command') rule.command = value
  else {
    if (drafts.value[index]) drafts.value[index][key] = value
    rule[key] = ids(value)
  }
  commit(next)
}
async function add() {
  if (!rules.value || rules.value.length >= 100) return
  const index = rules.value.length
  drafts.value.push({ roleIds: '', userIds: '' })
  activeRule.value = index
  commit([...rules.value, { command: '', roleIds: [], userIds: [] }])
  await nextTick()
  focusCommand(index)
}
function focusCommand(index: number) {
  editor.value
    ?.querySelectorAll<HTMLElement>('.permission-rule')
    .item(index)
    ?.querySelector<HTMLElement>('[role="combobox"], [data-command-input]')
    ?.focus()
}
async function remove(index: number) {
  if (!rules.value) return
  drafts.value.splice(index, 1)
  const next = rules.value.filter((_, current) => current !== index)
  activeRule.value = next.length ? Math.min(index, next.length - 1) : null
  commit(next)
  await nextTick()
  if (activeRule.value === null)
    editor.value?.querySelector<HTMLButtonElement>('[data-add-rule]')?.focus()
  else focusCommand(activeRule.value)
}
function toggle(event: Event, index: number) {
  if (!props.collapsible) return
  const open = (event.target as HTMLDetailsElement).open
  if (open) activeRule.value = index
  else if (activeRule.value === index) activeRule.value = null
}
</script>

<template>
  <div ref="editor" class="mt-md grid min-w-0 gap-md">
    <div v-if="!hideSummary" class="flex items-start gap-sm">
      <ShieldCheck :size="20" class="shrink-0 text-text-secondary" aria-hidden="true" />
      <div>
        <strong class="text-sm">{{ text('Command access', 'กำหนดผู้ใช้คำสั่ง') }}</strong>
        <p class="mt-xxs text-xs text-text-secondary">
          {{
            text(
              'Commands without matching rules keep their Feature’s original permissions.',
              'ถ้าไม่สร้าง Rule ระบบจะใช้สิทธิ์เดิมของแต่ละ Feature',
            )
          }}
        </p>
      </div>
    </div>
    <div v-if="!rules" class="space-y-sm">
      <p role="alert" class="text-sm text-error-text">
        {{
          text(
            'Permission rules could not be read. Correct the JSON below to continue.',
            'อ่านกฎสิทธิ์ไม่ได้ กรุณาแก้ JSON ด้านล่างเพื่อใช้งานต่อ',
          )
        }}
      </p>
      <label class="block text-sm"
        >{{ text('Permission rules JSON', 'JSON กฎสิทธิ์')
        }}<textarea
          class="field-control mt-xs min-h-40 resize-y py-sm font-mono"
          :value="modelValue"
          @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </div>
    <div
      v-else-if="!rules.length"
      class="grid min-h-32 content-center justify-items-center gap-xs rounded-lg border border-dashed border-border-default p-md text-center text-text-muted"
    >
      <UsersRound :size="24" aria-hidden="true" />
      <p class="text-sm">{{ text('No additional rules', 'ยังไม่มีกฎเพิ่มเติม') }}</p>
      <p class="text-xs">
        {{
          text(
            'Commands use their Feature’s original permissions.',
            'คำสั่งจะใช้สิทธิ์เดิมของแต่ละ Feature',
          )
        }}
      </p>
    </div>
    <component
      v-for="(rule, index) in rules ?? []"
      :key="index"
      :is="collapsible ? 'details' : 'article'"
      class="permission-rule min-w-0 rounded-lg border border-border-default bg-bg-default"
      :open="collapsible ? activeRule === index : undefined"
      @toggle="toggle($event, index)"
    >
      <component
        :is="collapsible ? 'summary' : 'header'"
        class="permission-rule-heading flex items-center gap-xs rounded-t-lg bg-bg-surface px-sm py-xs"
        :class="{ 'cursor-pointer': collapsible }"
      >
        <ChevronDown
          v-if="collapsible"
          :size="16"
          class="permission-chevron shrink-0 text-text-muted"
          aria-hidden="true"
        />
        <span v-if="collapsible" class="shrink-0 text-xs text-text-muted">{{ index + 1 }}</span>
        <span v-if="collapsible" class="min-w-0 flex-1"
          ><strong class="block truncate font-mono text-sm font-medium">{{
            rule.command || text('New rule', 'กฎใหม่')
          }}</strong
          ><span class="mt-xxs block text-xs text-text-secondary">{{
            rule.roleIds.length || rule.userIds.length
              ? `${rule.roleIds.length} Role · ${rule.userIds.length} User`
              : text('Administrators only', 'เฉพาะ Administrator')
          }}</span></span
        >
        <strong v-else class="text-sm">Rule {{ index + 1 }}</strong>
        <span
          v-if="!hideAdminBadge"
          class="inline-flex items-center gap-xxs text-xs text-text-secondary"
          ><Crown :size="14" aria-hidden="true" />Admin bypass</span
        >
        <button
          type="button"
          class="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-error-bg hover:text-error-text"
          :aria-label="`${text('Delete rule', 'ลบ Rule')} ${index + 1}`"
          @click.stop.prevent="remove(index)"
        >
          <Trash2 :size="16" aria-hidden="true" />
        </button>
      </component>
      <div class="border-t border-border-subtle p-sm">
        <PermissionCommandPicker
          v-if="commandFeatures"
          :model-value="rule.command"
          :features="commandFeatures"
          @update:model-value="update(index, 'command', $event)"
        />
        <template v-else>
          <label :for="`${id}-command-${index}`" class="block text-sm font-medium"
            >Command / Subcommand</label
          >
          <input
            :id="`${id}-command-${index}`"
            data-command-input
            :value="rule.command"
            class="field-control mt-xs h-11 font-mono"
            maxlength="80"
            required
            :placeholder="text('e.g. spending/add or *', 'เช่น spending/add หรือ *')"
            @input="update(index, 'command', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <div class="mt-md grid gap-md tablet:grid-cols-2">
          <div v-for="target in ['roleIds', 'userIds'] as const" :key="target">
            <label :for="`${id}-${target}-${index}`" class="block text-sm font-medium">{{
              target === 'roleIds' ? 'Role IDs' : 'User IDs'
            }}</label>
            <input
              :id="`${id}-${target}-${index}`"
              :value="drafts[index]?.[target] ?? rule[target].join(', ')"
              class="field-control mt-xs h-11"
              :placeholder="
                target === 'roleIds'
                  ? text('Paste Role IDs separated by commas', 'วาง Role ID แล้วคั่นด้วย comma')
                  : text('Paste User IDs separated by commas', 'วาง User ID แล้วคั่นด้วย comma')
              "
              :aria-invalid="idError(drafts[index]?.[target] ?? '') || undefined"
              :aria-describedby="`${id}-${target}-${index}-help`"
              @input="update(index, target, ($event.target as HTMLInputElement).value)"
            />
            <p
              :id="`${id}-${target}-${index}-help`"
              class="mt-xs text-xs"
              :class="
                idError(drafts[index]?.[target] ?? '') ? 'text-error-text' : 'text-text-muted'
              "
            >
              {{
                idError(drafts[index]?.[target] ?? '')
                  ? text(
                      'Each Discord ID must have 15–30 digits.',
                      'Discord ID แต่ละรายการต้องเป็นตัวเลข 15–30 หลัก',
                    )
                  : text(
                      'Separate multiple IDs with commas or spaces.',
                      'หลาย ID คั่นด้วย comma หรือเว้นวรรค',
                    )
              }}
            </p>
          </div>
        </div>
      </div>
    </component>
    <button
      type="button"
      data-add-rule
      :disabled="!rules || rules.length >= 100"
      class="inline-flex w-fit items-center gap-xs rounded-md border border-border-default px-sm py-xs text-sm hover:bg-bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
      @click="add"
    >
      <Plus :size="16" aria-hidden="true" />{{ text('Add rule', 'เพิ่ม Rule') }}
    </button>
  </div>
</template>

<style scoped>
details.permission-rule:not([open]) > div {
  display: none;
}
details.permission-rule:not([open]) {
  background: var(--semantic-color-background-bg-surface);
}
details.permission-rule:not([open]) > .permission-rule-heading {
  background: transparent;
}
.permission-rule-heading {
  list-style: none;
}
.permission-rule-heading::-webkit-details-marker {
  display: none;
}
.permission-rule-heading::before {
  display: none;
}
.permission-chevron {
  transform: rotate(-90deg);
}
.permission-rule[open] > .permission-rule-heading .permission-chevron {
  transform: none;
}
button:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 2px;
}
</style>
