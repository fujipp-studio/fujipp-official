<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff, Gamepad2, KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-vue-next'

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
  emit('update:credentialsJson', JSON.stringify(credentialsPayload))
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
</script>

<template>
  <div class="space-y-lg border-t border-border-subtle pt-lg">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="flex items-center gap-xs text-base font-semibold text-text-primary">
          <Gamepad2 class="size-5 text-accent-primary" />
          {{ text('Roblox Groups Settings', 'การตั้งค่า Roblox Groups (การ์ดตามกลุ่ม)') }}
        </h3>
        <p class="mt-xxs text-xs text-text-secondary">
          {{ text('Manage Roblox groups and Credentials/2FA per group as blocks', 'จัดการกลุ่ม Roblox และข้อมูล Credentials/2FA ของแต่ละกลุ่มในรูปแบบบล็อกการ์ด') }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-xs rounded-lg bg-accent-primary px-md py-sm text-xs font-medium text-text-on-accent transition-all hover:brightness-110"
        @click="addGroup"
      >
        <Plus class="size-4" />
        {{ text('Add Roblox Group', 'เพิ่มกลุ่ม Roblox') }}
      </button>
    </div>

    <!-- Group Card Blocks -->
    <div class="grid gap-lg">
      <div
        v-for="(group, index) in groups"
        :key="group.id"
        class="rounded-xl border border-border-subtle bg-bg-surface p-lg shadow-sm transition-all hover:border-border-default"
      >
        <!-- Card Header -->
        <div class="mb-md flex items-center justify-between border-b border-border-subtle pb-sm">
          <div class="flex items-center gap-xs">
            <span
              class="inline-flex items-center rounded-md bg-accent-primary/10 px-xs py-xxs text-xs font-bold text-accent-primary"
            >
              {{ text(`Group ${index + 1}`, `กลุ่มที่ ${index + 1}`) }}
            </span>
            <span class="text-sm font-semibold text-text-primary">
              {{ group.name || text('Unnamed Group', 'ยังไม่ได้ตั้งชื่อ') }}
            </span>
            <span v-if="group.key" class="font-mono text-xs text-text-secondary">
              ({{ group.key }})
            </span>
          </div>
          <button
            v-if="groups.length > 1"
            type="button"
            class="inline-flex items-center gap-xxs rounded-md px-xs py-xxs text-xs text-error-text transition-colors hover:bg-error-bg/20"
            :title="text('Delete this group', 'ลบกลุ่มนี้')"
            @click="removeGroup(index)"
          >
            <Trash2 class="size-4" />
            {{ text('Delete Group', 'ลบกลุ่ม') }}
          </button>
        </div>

        <!-- Form Fields Grid -->
        <div class="grid gap-md desktop:grid-cols-2">
          <!-- Group Name -->
          <div>
            <label class="block text-xs font-medium text-text-primary">
              {{ text('Group Name', 'ชื่อกลุ่ม (Group Name)') }} <span class="text-error-text">*</span>
            </label>
            <input
              v-model="group.name"
              type="text"
              class="field-control mt-xs h-11"
              :placeholder="text('e.g. Group 1 or Main Group', 'เช่น Group 1 หรือ Main Group')"
            />
          </div>

          <!-- Group Key -->
          <div>
            <label class="block text-xs font-medium text-text-primary">
              {{ text('Group Key', 'รหัสกลุ่ม (Group Key)') }} <span class="text-error-text">*</span>
            </label>
            <input
              v-model="group.key"
              type="text"
              class="field-control mt-xs h-11 font-mono text-sm"
              placeholder="main"
              @input="sanitizeKey(group)"
            />
            <p class="mt-xxs text-[11px] text-text-secondary">
              {{ text('Lowercase letters only, no spaces (reference key)', 'ภาษาอังกฤษตัวเล็ก ไม่มีเว้นวรรค (ใช้เป็น Key อ้างอิง)') }}
            </p>
          </div>

          <!-- Group ID -->
          <div>
            <label class="block text-xs font-medium text-text-primary">
              Roblox Group ID <span class="text-error-text">*</span>
            </label>
            <input
              v-model.number="group.groupId"
              type="number"
              class="field-control mt-xs h-11 font-mono text-sm"
              placeholder="34777878"
            />
            <p class="mt-xxs text-[11px] text-text-secondary">
              {{ text('Numeric Group ID from Roblox URL (e.g. roblox.com/communities/34777878)', 'ตัวเลข ID กลุ่มจาก URL ของ Roblox (เช่น roblox.com/communities/34777878)') }}
            </p>
          </div>

          <!-- 2FA TOTP Secret -->
          <div>
            <label class="flex items-center justify-between text-xs font-medium text-text-primary">
              <span class="flex items-center gap-xxs">
                <ShieldCheck class="size-3.5 text-accent-primary" />
                2FA Secret Key (TOTP)
              </span>
              <span class="text-[11px] text-text-secondary">{{ text('(If 2FA is enabled)', '(ถ้าเปิด 2FA ใน Roblox)') }}</span>
            </label>
            <div class="relative mt-xs">
              <input
                v-model="group.totpSecret"
                :type="group.showTotp ? 'text' : 'password'"
                class="field-control h-11 pr-10 font-mono text-xs"
                placeholder="JBSWY3DPEHPK3PXP"
                autocomplete="off"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-xs text-text-secondary hover:text-text-primary"
                @click="group.showTotp = !group.showTotp"
              >
                <Eye v-if="!group.showTotp" class="size-4" />
                <EyeOff v-else class="size-4" />
              </button>
            </div>
            <p class="mt-xxs text-[11px] text-text-secondary">
              {{ text('Base32 Secret Key provided when setting up Authenticator App in Roblox', 'Base32 Secret Key ที่ให้มาตอนกดเปิด Authenticator App ใน Roblox') }}
            </p>
          </div>

          <!-- Roblox Cookie (.ROBLOSECURITY) - Full width -->
          <div class="desktop:col-span-2">
            <label class="flex items-center justify-between text-xs font-medium text-text-primary">
              <span class="flex items-center gap-xxs">
                <KeyRound class="size-3.5 text-accent-primary" />
                Roblox Cookie (.ROBLOSECURITY) <span class="text-error-text">*</span>
              </span>
              <span v-if="credentialsConfigured && !group.cookie" class="text-[11px] text-success">
                {{ text('✓ Existing cookie configured (overwrite to change)', '✓ มี Cookie เดิมตั้งค่าไว้อยู่แล้ว (พิมพ์ทับเพื่อเปลี่ยนใหม่)') }}
              </span>
            </label>
            <div class="relative mt-xs">
              <input
                v-model="group.cookie"
                :type="group.showCookie ? 'text' : 'password'"
                class="field-control h-11 pr-10 font-mono text-xs"
                :placeholder="
                  credentialsConfigured
                    ? text('•••••••• (Cookie configured - paste new to change)', '•••••••• (มี Cookie ตั้งค่าไว้แล้ว - วางใหม่ถ้าต้องการเปลี่ยน)')
                    : text('Paste .ROBLOSECURITY cookie copied from browser', 'วางคุกกี้ .ROBLOSECURITY ที่คัดลอกมาจากเบราว์เซอร์')
                "
                autocomplete="off"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-xs text-text-secondary hover:text-text-primary"
                @click="group.showCookie = !group.showCookie"
              >
                <Eye v-if="!group.showCookie" class="size-4" />
                <EyeOff v-else class="size-4" />
              </button>
            </div>
            <p class="mt-xxs text-[11px] text-text-secondary">
              {{ text('Roblox account cookie that owns or has permission to transfer Robux in this group', 'คุกกี้บัญชี Roblox ที่เป็นเจ้าของ/มีสิทธิ์โอน Robux ในกลุ่มนี้') }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Add Group Button -->
    <div class="flex justify-center border-t border-border-subtle pt-md">
      <button
        type="button"
        class="inline-flex items-center gap-xs rounded-xl border border-dashed border-border-default bg-bg-surface px-lg py-md text-sm font-medium text-text-primary transition-all hover:border-accent-primary hover:bg-accent-primary/5 hover:text-accent-primary"
        @click="addGroup"
      >
        <Plus class="size-5" />
        เพิ่มกลุ่ม Roblox ถัดไป (Group #{{ groups.length + 1 }})
      </button>
    </div>
  </div>
</template>
