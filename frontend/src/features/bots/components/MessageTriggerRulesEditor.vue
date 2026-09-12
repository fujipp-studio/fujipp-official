<script setup lang="ts">
import { computed } from 'vue'
import { Hash, MessageSquareText, Plus, Trash2 } from 'lucide-vue-next'

type RuleKind = 'channel-create' | 'admin-message'
type Rule = { categoryId?: string; trigger?: string; template: string }

const props = defineProps<{
  modelValue: string
  kind: RuleKind
  templates: Array<{ value: string; label: string }>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const rules = computed<Rule[]>(() => {
  try {
    const value: unknown = JSON.parse(props.modelValue)
    if (!Array.isArray(value)) return []
    const parsed: Rule[] = []
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const record = item as Record<string, unknown>
      const template = String(record.template ?? props.templates[0]?.value ?? 'template_1')
      parsed.push(
        props.kind === 'channel-create'
          ? { categoryId: String(record.categoryId ?? ''), template }
          : { trigger: String(record.trigger ?? ''), template },
      )
    }
    return parsed
  } catch {
    return []
  }
})

const targetKey = computed<'categoryId' | 'trigger'>(() =>
  props.kind === 'channel-create' ? 'categoryId' : 'trigger',
)
const title = computed(() =>
  props.kind === 'channel-create' ? 'Category Trigger' : 'Admin Message Trigger',
)
const description = computed(() =>
  props.kind === 'channel-create'
    ? 'เมื่อมีห้องข้อความใหม่ใน Category นี้ บอทจะส่ง Template ที่เลือก'
    : 'ตรงกับข้อความทั้งประโยค ไม่สนตัวพิมพ์เล็ก-ใหญ่ และบอทจะลบข้อความ Trigger ก่อนส่ง Template',
)

function commit(value: Rule[]) {
  emit('update:modelValue', JSON.stringify(value, null, 2))
}
function update(index: number, key: 'categoryId' | 'trigger' | 'template', value: string) {
  const next = rules.value.map((rule) => ({ ...rule }))
  if (!next[index]) return
  next[index][key] = value
  commit(next)
}
function add() {
  const template = props.templates[0]?.value ?? 'template_1'
  commit([
    ...rules.value,
    props.kind === 'channel-create' ? { categoryId: '', template } : { trigger: '', template },
  ])
}
function remove(index: number) {
  commit(rules.value.filter((_, itemIndex) => itemIndex !== index))
}
</script>

<template>
  <div class="trigger-editor">
    <div class="trigger-summary">
      <span class="trigger-summary__icon">
        <Hash v-if="kind === 'channel-create'" :size="20" />
        <MessageSquareText v-else :size="20" />
      </span>
      <span>
        <strong>{{ title }}</strong>
        <small>{{ description }}</small>
      </span>
    </div>

    <div v-if="!rules.length" class="trigger-empty">
      ยังไม่มีกฎสำหรับ {{ title }}
    </div>

    <article v-for="(rule, index) in rules" :key="index" class="trigger-rule">
      <header>
        <strong>Rule {{ index + 1 }}</strong>
        <button type="button" :aria-label="`ลบ Rule ${index + 1}`" @click="remove(index)">
          <Trash2 :size="17" />
        </button>
      </header>
      <div class="trigger-fields">
        <div class="trigger-field">
          <span>{{ kind === 'channel-create' ? 'Discord Category ID' : 'ข้อความ Trigger' }}</span>
          <input
            :value="String(rule[targetKey] ?? '')"
            :placeholder="kind === 'channel-create' ? '123456789012345678' : 'pay'"
            :maxlength="kind === 'channel-create' ? 30 : 100"
            :inputmode="kind === 'channel-create' ? 'numeric' : 'text'"
            :aria-label="kind === 'channel-create' ? 'Discord Category ID' : 'ข้อความ Trigger'"
            @input="update(index, targetKey, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="trigger-field">
          <span>Message Template</span>
          <select
            :value="rule.template"
            aria-label="Message Template"
            @change="update(index, 'template', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="template in templates" :key="template.value" :value="template.value">
              {{ template.label }}
            </option>
          </select>
        </div>
      </div>
    </article>

    <button type="button" class="trigger-add" :disabled="rules.length >= 25" @click="add">
      <Plus :size="17" /> เพิ่ม Rule
    </button>
  </div>
</template>

<style scoped>
.trigger-editor { display: grid; gap: var(--space-md); margin-top: var(--space-sm); }
.trigger-summary { display: flex; align-items: center; gap: var(--space-sm); }
.trigger-summary__icon { display: grid; width: 2.5rem; height: 2.5rem; flex: 0 0 auto; place-items: center; border-radius: var(--radius-md); background: var(--semantic-color-action-backgrounds-bg-secondary); color: var(--semantic-color-action-text-text-on-secondary); }
.trigger-summary strong, .trigger-summary small { display: block; }
.trigger-summary small { margin-top: var(--space-xxs); color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-label-small); font-weight: var(--typography-font-weight-regular); }
.trigger-empty { padding: var(--space-lg); border: 1px dashed var(--semantic-color-border-border-default); border-radius: var(--radius-lg); color: var(--semantic-color-text-text-muted); text-align: center; }
.trigger-rule { overflow: hidden; border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-lg); background: var(--semantic-color-background-bg-default); }
.trigger-rule header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-xs) var(--space-sm); border-bottom: 1px solid var(--semantic-color-border-border-subtle); background: var(--semantic-color-background-bg-surface); }
.trigger-rule header button { display: grid; width: 2rem; height: 2rem; place-items: center; border-radius: var(--radius-md); color: var(--semantic-color-error-error-text); }
.trigger-rule header button:hover { background: var(--semantic-color-error-error-bg); }
.trigger-fields { display: grid; gap: var(--space-sm); padding: var(--space-sm); }
.trigger-field { display: grid; gap: var(--space-xxs); color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-label-small); }
.trigger-field input, .trigger-field select { width: 100%; height: 2.75rem; padding: 0 var(--space-sm); border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-md); background: var(--semantic-color-background-bg-surface); color: var(--semantic-color-text-text-primary); outline: none; }
.trigger-field input:focus, .trigger-field select:focus { border-color: var(--semantic-color-action-borders-border-focus); box-shadow: 0 0 0 1px var(--semantic-color-action-borders-border-focus); }
.trigger-add { display: inline-flex; width: fit-content; height: 2.5rem; align-items: center; gap: var(--space-xs); padding: 0 var(--space-md); border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-md); background: var(--semantic-color-background-bg-surface); font-weight: var(--typography-font-weight-medium); }
.trigger-add:hover:not(:disabled) { background: var(--semantic-color-background-bg-surface-hover); }
.trigger-add:disabled { cursor: not-allowed; opacity: .5; }
@media (min-width: 768px) { .trigger-fields { grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); } }
</style>
