<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckCircle2, ChevronDown, Gamepad2, KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-vue-next'
import { AppButton, AppTextField } from '../../../shared/ui'

export interface GroupBlock {
  id: string
  key: string
  name: string
  groupId: number | ''
  cookie: string
  totpSecret: string
  showCookie?: boolean
  showTotp?: boolean
}

const props = defineProps<{
  groupsJson: string
  credentialsConfigured?: boolean
  credentialsJson: string
}>()

const emit = defineEmits<{
  (e: 'update:groupsJson', value: string): void
  (e: 'update:credentialsJson', value: string): void
}>()

const { locale } = useI18n()
const text = (english: string, thai: string) => (locale.value === 'th' ? thai : english)

const groups = ref<GroupBlock[]>([])
const initialized = ref(false)

function createEmptyGroup(index: number): GroupBlock {
  const key = index === 1 ? 'main' : `group-${index}`
  return {
    id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    key,
    name: `Group ${index}`,
    groupId: '',
    cookie: '',
    totpSecret: '',
    showCookie: false,
    showTotp: false,
  }
}

function parseInitialData() {
  if (initialized.value) return
  let parsedGroups: Array<Record<string, unknown>> = []
  try {
    const raw = JSON.parse(props.groupsJson)
    if (Array.isArray(raw)) parsedGroups = raw.filter((item) => item && typeof item === 'object')
  } catch {
    /* invalid or empty JSON */
  }

  let parsedCreds: Record<string, { cookie?: string; totpSecret?: string }> = {}
  try {
    if (props.credentialsJson) {
      const raw = JSON.parse(props.credentialsJson)
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        parsedCreds = raw as Record<string, { cookie?: string; totpSecret?: string }>
      }
    }
  } catch {
    /* invalid or empty JSON */
  }

  if (parsedGroups.length > 0) {
    groups.value = parsedGroups.map((g, idx) => {
      const key = String(g.key ?? `group-${idx + 1}`)
      const cred = parsedCreds[key] ?? {}
      return {
        id: `group-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        key,
        name: String(g.name ?? `Group ${idx + 1}`),
        groupId: typeof g.groupId === 'number' ? g.groupId : Number(g.groupId) || '',
        cookie: cred.cookie ?? '',
        totpSecret: cred.totpSecret ?? '',
        showCookie: false,
        showTotp: false,
      }
    })
  } else {
    groups.value = [createEmptyGroup(1)]
  }

  initialized.value = true
}

function emitChanges() {
  if (!initialized.value) return

  const groupsPayload = groups.value.map((g, idx) => ({
    key: (g.key || `group-${idx + 1}`).trim(),
    name: (g.name || `Group ${idx + 1}`).trim(),
    groupId: typeof g.groupId === 'number' ? g.groupId : Number(g.groupId) || 0,
  }))

  const credentialsPayload: Record<string, { cookie?: string; totpSecret?: string }> = {}
  for (const g of groups.value) {
    const key = (g.key || 'group').trim()
    if (!key) continue
    const cred: { cookie?: string; totpSecret?: string } = {}
    if (g.cookie.trim()) cred.cookie = g.cookie.trim()
    if (g.totpSecret.trim()) cred.totpSecret = g.totpSecret.trim()
    if (Object.keys(cred).length > 0) {
      credentialsPayload[key] = cred
    }
  }

  emit('update:groupsJson', JSON.stringify(groupsPayload, null, 2))
  emit(
    'update:credentialsJson',
    Object.keys(credentialsPayload).length ? JSON.stringify(credentialsPayload) : '',
  )
}

watch([() => props.groupsJson, () => props.credentialsJson], () => parseInitialData(), {
  immediate: true,
})
watch(groups, () => emitChanges(), { deep: true })

function addGroup() {
  const nextNum = groups.value.length + 1
  groups.value.push(createEmptyGroup(nextNum))
}

function removeGroup(index: number) {
  if (groups.value.length <= 1) return
  groups.value.splice(index, 1)
}

function sanitizeKey(group: GroupBlock) {
  group.key = group.key.toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

function updateGroupId(group: GroupBlock, value: string) {
  group.groupId = value ? Number(value) || '' : ''
}

function groupReady(group: GroupBlock) {
  return Boolean(group.name.trim() && group.key.trim() && Number(group.groupId) > 0)
}
</script>

<template>
  <section class="roblox-groups">
    <header class="roblox-groups__header">
      <div class="roblox-groups__title">
        <span class="roblox-groups__icon"><Gamepad2 /></span>
        <div>
          <h3>{{ text('Roblox groups', 'กลุ่ม Roblox') }}</h3>
          <p>{{ text('Connect each payout group with its own credentials.', 'เชื่อมต่อแต่ละกลุ่มสำหรับโอน Robux พร้อม Credentials ของกลุ่มนั้น') }}</p>
        </div>
      </div>
      <AppButton class="roblox-groups__add" @click="addGroup">
        <Plus class="size-4" /> {{ text('Add group', 'เพิ่มกลุ่ม') }}
      </AppButton>
    </header>

    <div class="roblox-groups__summary">
      <span><strong>{{ groups.length }}</strong> {{ text('groups', 'กลุ่ม') }}</span>
      <span v-if="credentialsConfigured"><CheckCircle2 class="size-4" /> {{ text('Credentials saved', 'บันทึก Credentials แล้ว') }}</span>
    </div>

    <div class="roblox-groups__list">
      <details v-for="(group, index) in groups" :key="group.id" class="roblox-group" open>
        <summary class="roblox-group__summary">
          <ChevronDown class="roblox-group__chevron" />
          <span class="roblox-group__number">{{ index + 1 }}</span>
          <span class="roblox-group__identity">
            <strong>{{ group.name || text('Unnamed group', 'กลุ่มที่ยังไม่มีชื่อ') }}</strong>
            <small>{{ group.key || text('No key', 'ยังไม่มี Key') }} · {{ group.groupId || '—' }}</small>
          </span>
          <span :class="['roblox-group__status', { 'roblox-group__status--ready': groupReady(group) }]">
            {{ groupReady(group) ? text('Ready', 'พร้อมใช้งาน') : text('Setup required', 'ต้องตั้งค่า') }}
          </span>
        </summary>

        <div class="roblox-group__body">
          <div class="roblox-group__section">
            <div class="roblox-group__section-title">
              <Gamepad2 class="size-4" />
              <div><strong>{{ text('Group information', 'ข้อมูลกลุ่ม') }}</strong><small>{{ text('Public identifiers used by the panel.', 'ข้อมูลอ้างอิงที่แสดงและใช้กับ Panel') }}</small></div>
            </div>
            <div class="roblox-group__grid">
              <AppTextField v-model="group.name" :label="text('Group name', 'ชื่อกลุ่ม')" :placeholder="text('Main group', 'กลุ่มหลัก')" required />
              <AppTextField
                :model-value="group.key"
                :label="text('Group key', 'รหัสอ้างอิงกลุ่ม')"
                placeholder="main"
                :support-text="text('Lowercase letters, numbers, hyphens and underscores only.', 'ใช้ตัวพิมพ์เล็ก ตัวเลข ขีดกลาง และขีดล่างเท่านั้น')"
                required
                @update:model-value="(value) => { group.key = value; sanitizeKey(group) }"
              />
              <AppTextField
                :model-value="String(group.groupId)"
                label="Roblox Group ID"
                placeholder="34777878"
                input-type="number"
                :support-text="text('Find it in the Roblox community URL.', 'ดูได้จาก URL หน้า Community ของ Roblox')"
                required
                @update:model-value="(value) => updateGroupId(group, value)"
              />
            </div>
          </div>

          <div class="roblox-group__section roblox-group__section--security">
            <div class="roblox-group__section-title">
              <ShieldCheck class="size-4" />
              <div><strong>{{ text('Security credentials', 'ข้อมูลยืนยันตัวตน') }}</strong><small>{{ text('Stored securely and never shown again after saving.', 'จัดเก็บอย่างปลอดภัยและจะไม่แสดงค่าเดิมหลังบันทึก') }}</small></div>
            </div>
            <div class="roblox-group__grid">
              <AppTextField
                v-model="group.cookie"
                class="roblox-group__cookie"
                variant="secret"
                label="Roblox Cookie (.ROBLOSECURITY)"
                :placeholder="credentialsConfigured ? text('Saved — paste a new cookie to replace it', 'บันทึกแล้ว — วาง Cookie ใหม่เมื่อต้องการเปลี่ยน') : text('Paste the .ROBLOSECURITY cookie', 'วาง Cookie .ROBLOSECURITY')"
                :support-text="text('Use an account permitted to transfer group Robux.', 'ใช้บัญชีที่มีสิทธิ์โอน Robux ของกลุ่ม')"
                autocomplete="new-password"
              />
              <AppTextField
                v-model="group.totpSecret"
                variant="secret"
                label="2FA Secret Key (TOTP)"
                placeholder="JBSWY3DPEHPK3PXP"
                :support-text="text('Optional. Required only when Authenticator 2FA is enabled.', 'ไม่บังคับ ใช้เมื่อบัญชีเปิด Authenticator 2FA')"
                autocomplete="new-password"
              />
            </div>
          </div>

          <div class="roblox-group__footer">
            <span><KeyRound class="size-4" /> {{ text('Secrets are updated only when a new value is entered.', 'Secret จะเปลี่ยนเฉพาะเมื่อกรอกค่าใหม่') }}</span>
            <AppButton v-if="groups.length > 1" class="roblox-group__delete" variant="secondary" @click="removeGroup(index)">
              <Trash2 class="size-4" /> {{ text('Delete group', 'ลบกลุ่ม') }}
            </AppButton>
          </div>
        </div>
      </details>
    </div>

    <button type="button" class="roblox-groups__add-another" @click="addGroup">
      <Plus class="size-5" />
      <span><strong>{{ text('Add another Roblox group', 'เพิ่มกลุ่ม Roblox อีกกลุ่ม') }}</strong><small>{{ text('Configure a separate payout source.', 'ตั้งค่าแหล่งโอน Robux แยกอีกกลุ่ม') }}</small></span>
    </button>
  </section>
</template>

<style scoped>
.roblox-groups { display: grid; gap: var(--space-md); padding-top: var(--space-lg); border-top: 1px solid var(--semantic-color-border-border-subtle); }
.roblox-groups__header, .roblox-group__footer { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); }
.roblox-groups__title { display: flex; align-items: center; gap: var(--space-sm); }
.roblox-groups__icon { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--corner-radius-md); background: var(--semantic-color-background-bg-elevated); }
.roblox-groups__icon svg { width: var(--icon-size-24); }
.roblox-groups h3 { font-size: var(--font-size-heading-small); font-weight: var(--typography-font-weight-bold); }
.roblox-groups p, .roblox-group small { color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-body-small); }
.roblox-groups__add { width: auto; }
.roblox-groups__summary { display: flex; flex-wrap: wrap; gap: var(--space-xs); }
.roblox-groups__summary span { display: inline-flex; align-items: center; gap: var(--space-xxs); padding: var(--space-xxs) var(--space-xs); border: 1px solid var(--semantic-color-border-border-subtle); border-radius: var(--radius-full); background: var(--semantic-color-background-bg-surface); font-size: var(--font-size-label-small); }
.roblox-groups__list { display: grid; gap: var(--space-sm); }
.roblox-group { overflow: hidden; border: 1px solid var(--semantic-color-border-border-subtle); border-radius: var(--corner-radius-lg); background: var(--semantic-color-background-bg-surface); box-shadow: var(--effect-shadow-sm); }
.roblox-group__summary { display: flex; min-height: 4.5rem; align-items: center; gap: var(--space-sm); padding: var(--space-md); cursor: pointer; list-style: none; }
.roblox-group__summary::-webkit-details-marker { display: none; }
.roblox-group__chevron { flex: none; transition: transform 160ms ease; }
.roblox-group[open] .roblox-group__chevron { transform: rotate(180deg); }
.roblox-group__number { display: grid; width: 2rem; height: 2rem; flex: none; place-items: center; border-radius: var(--radius-full); background: var(--semantic-color-action-backgrounds-bg-secondary); font-weight: var(--typography-font-weight-bold); }
.roblox-group__identity { display: grid; min-width: 0; flex: 1; }
.roblox-group__identity strong, .roblox-group__identity small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.roblox-group__status { padding: var(--space-xxs) var(--space-xs); border-radius: var(--radius-full); background: var(--semantic-color-background-bg-elevated); color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-label-small); }
.roblox-group__status--ready { color: var(--semantic-color-success-success-text); }
.roblox-group__body { display: grid; gap: var(--space-md); padding: 0 var(--space-md) var(--space-md); border-top: 1px solid var(--semantic-color-border-border-subtle); }
.roblox-group__section { display: grid; gap: var(--space-md); padding-top: var(--space-md); }
.roblox-group__section--security { padding: var(--space-md); border: 1px solid var(--semantic-color-border-border-subtle); border-radius: var(--corner-radius-md); background: var(--semantic-color-background-bg-elevated); }
.roblox-group__section-title { display: flex; align-items: flex-start; gap: var(--space-xs); }
.roblox-group__section-title > div { display: grid; }
.roblox-group__grid { display: grid; gap: var(--space-md); }
.roblox-group__footer { color: var(--semantic-color-text-text-secondary); font-size: var(--font-size-body-small); }
.roblox-group__footer > span { display: flex; align-items: center; gap: var(--space-xxs); }
.roblox-group__delete { width: auto; color: var(--semantic-color-error-error-text); }
.roblox-groups__add-another { display: flex; align-items: center; justify-content: center; gap: var(--space-sm); padding: var(--space-md); border: 1px dashed var(--semantic-color-border-border-default); border-radius: var(--corner-radius-lg); background: transparent; color: var(--semantic-color-text-text-primary); text-align: left; }
.roblox-groups__add-another:hover { background: var(--semantic-color-background-bg-surface-hover); }
.roblox-groups__add-another span { display: grid; }
@media (min-width: 48rem) { .roblox-group__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .roblox-group__cookie { grid-column: 1 / -1; } }
@media (max-width: 47.99rem) { .roblox-groups__header, .roblox-group__footer { align-items: stretch; flex-direction: column; } .roblox-groups__add, .roblox-group__delete { width: 100%; } .roblox-group__status { display: none; } }
@media (prefers-reduced-motion: reduce) { .roblox-group__chevron { transition: none; } }
</style>
