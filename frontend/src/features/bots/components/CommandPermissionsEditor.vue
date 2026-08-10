<script setup lang="ts">
import { computed } from 'vue'
import { Command, Crown, Plus, ShieldCheck, Trash2, UserRound, UsersRound } from 'lucide-vue-next'

interface Rule { command: string; roleIds: string[]; userIds: string[] }
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const rules = computed<Rule[]>(() => {
  try {
    const value = JSON.parse(props.modelValue)
    return Array.isArray(value) ? value : []
  } catch { return [] }
})
function commit(value: Rule[]) { emit('update:modelValue', JSON.stringify(value, null, 2)) }
function ids(value: string) { return value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean) }
function update(index: number, key: keyof Rule, value: string) {
  const next = rules.value.map((rule) => ({ ...rule, roleIds: [...rule.roleIds], userIds: [...rule.userIds] }))
  const rule = next[index]
  if (!rule) return
  if (key === 'command') rule.command = value
  else rule[key] = ids(value)
  commit(next)
}
function add() { commit([...rules.value, { command: '', roleIds: [], userIds: [] }]) }
function remove(index: number) { commit(rules.value.filter((_, i) => i !== index)) }
</script>

<template>
  <div class="permission-editor">
    <div class="permission-summary">
      <span class="permission-summary__icon"><ShieldCheck :size="20" /></span>
      <div>
        <strong>กำหนดผู้ใช้คำสั่ง</strong>
        <p>ถ้าไม่สร้าง Rule ระบบจะใช้สิทธิ์เดิมของแต่ละ Feature</p>
      </div>
    </div>

    <div v-if="!rules.length" class="permission-empty">
      <UsersRound :size="26" />
      <span>ยังไม่มีกฎเพิ่มเติม</span>
      <small>Administrator ยังใช้งานได้เสมอ</small>
    </div>

    <article v-for="(rule, index) in rules" :key="index" class="permission-rule">
      <header class="permission-rule__header">
        <span class="permission-rule__number">Rule {{ index + 1 }}</span>
        <span class="permission-rule__admin"><Crown :size="14" /> Admin bypass</span>
        <button type="button" class="permission-delete" :aria-label="`ลบ Rule ${index + 1}`" @click="remove(index)"><Trash2 :size="17" /></button>
      </header>
      <label class="permission-field permission-field--command">
        <span><Command :size="15" /> Command / Subcommand</span>
        <input :value="rule.command" placeholder="เช่น spending/add หรือ *" @input="update(index, 'command', ($event.target as HTMLInputElement).value)" />
      </label>
      <div class="permission-rule__targets">
        <label class="permission-field">
          <span><UsersRound :size="15" /> Role IDs</span>
          <input :value="rule.roleIds.join(', ')" placeholder="วาง Role ID แล้วคั่นด้วย comma" @input="update(index, 'roleIds', ($event.target as HTMLInputElement).value)" />
        </label>
        <label class="permission-field">
          <span><UserRound :size="15" /> User IDs</span>
          <input :value="rule.userIds.join(', ')" placeholder="วาง User ID แล้วคั่นด้วย comma" @input="update(index, 'userIds', ($event.target as HTMLInputElement).value)" />
        </label>
      </div>
    </article>

    <button type="button" class="permission-add" @click="add"><Plus :size="17" /> เพิ่ม Rule</button>
  </div>
</template>

<style scoped>
.permission-editor { display: grid; gap: var(--space-md); margin-top: var(--space-sm); }
.permission-summary { display: flex; align-items: center; gap: var(--space-sm); }
.permission-summary__icon { display: grid; width: 2.5rem; height: 2.5rem; place-items: center; border-radius: var(--radius-md); background: var(--semantic-color-action-backgrounds-bg-secondary); color: var(--semantic-color-action-text-text-on-secondary); }
.permission-summary strong { display: block; font-size: var(--font-size-label-large); }
.permission-summary p { margin-top: var(--space-xxs); color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-label-small); }
.permission-empty { display: grid; min-height: 8rem; place-items: center; align-content: center; gap: var(--space-xxs); border: 1px dashed var(--semantic-color-border-border-default); border-radius: var(--radius-lg); color: var(--semantic-color-text-text-muted); text-align: center; }
.permission-empty small { color: var(--semantic-color-text-text-secondary); }
.permission-rule { overflow: hidden; border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-lg); background: var(--semantic-color-background-bg-page); }
.permission-rule__header { display: flex; align-items: center; gap: var(--space-xs); padding: var(--space-xs) var(--space-sm); border-bottom: 1px solid var(--semantic-color-border-border-subtle); background: var(--semantic-color-background-bg-surface); }
.permission-rule__number { font-weight: var(--typography-font-weight-semibold); }
.permission-rule__admin { display: inline-flex; align-items: center; gap: var(--space-xxs); color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-label-small); }
.permission-delete { display: grid; width: 2rem; height: 2rem; margin-left: auto; place-items: center; border-radius: var(--radius-md); color: var(--semantic-color-error-error-text); }
.permission-delete:hover { background: var(--semantic-color-error-error-bg); }
.permission-field { display: grid; gap: var(--space-xxs); padding: var(--space-sm); color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-label-small); }
.permission-field span { display: inline-flex; align-items: center; gap: var(--space-xxs); font-weight: var(--typography-font-weight-medium); }
.permission-field input { width: 100%; height: 2.75rem; padding: 0 var(--space-sm); border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-md); background: var(--semantic-color-background-bg-surface); color: var(--semantic-color-text-text-primary); outline: none; }
.permission-field input:focus { border-color: var(--semantic-color-action-borders-border-focus); box-shadow: 0 0 0 1px var(--semantic-color-action-borders-border-focus); }
.permission-field--command { padding-bottom: var(--space-xs); }
.permission-field--command input { font-family: var(--font-family-mono); }
.permission-rule__targets { display: grid; }
.permission-add { display: inline-flex; width: fit-content; min-width: 9rem; height: 2.5rem; align-items: center; justify-content: center; gap: var(--space-xs); padding: 0 var(--space-md); border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--radius-md); background: var(--semantic-color-background-bg-surface); font-weight: var(--typography-font-weight-medium); }
.permission-add:hover { background: var(--semantic-color-background-bg-surface-hover); }
@media (min-width: 768px) {
  .permission-rule__targets { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .permission-rule__targets .permission-field + .permission-field { border-left: 1px solid var(--semantic-color-border-border-subtle); }
}
</style>
