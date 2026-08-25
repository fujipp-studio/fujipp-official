<script setup lang="ts">
import { ArrowLeft, Bot, BriefcaseBusiness, CircleGauge, House, PackageOpen, Pencil, Plus, ServerCog, Settings2, Store, Users, Wrench, X, type LucideIcon } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { fetchAdminWorks, type AdminWork } from '../../../services/backend'
import { useAuthStore } from '../../../stores'

type ToolGroup = 'navigation' | 'work' | 'bots' | 'admin'
interface ToolLink { label: string; description: string; path: string; icon: LucideIcon; action?: 'pick-work' }

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const open = ref(false)
const activeGroup = ref<ToolGroup>()
const workPickerOpen = ref(false)
const works = ref<AdminWork[]>([])
const worksLoading = ref(false)
const worksError = ref('')

const workLinks: ToolLink[] = [
  { label: 'เพิ่มผลงาน', description: 'สร้าง Portfolio รายการใหม่', path: '/work/add', icon: Plus },
  { label: 'แก้ไขผลงาน', description: 'เลือกผลงานที่ต้องการแก้ไข', path: '/work', icon: Pencil, action: 'pick-work' },
]
const botLinks: ToolLink[] = [
  { label: 'บอทของฉัน', description: 'บอทและ Runtime ของบัญชีนี้', path: '/my-bot', icon: Bot },
  { label: 'บอททั้งหมด', description: 'ตรวจสอบและจัดการบอทในระบบ', path: '/admin/bots', icon: Bot },
  { label: 'Runtime', description: 'แผน Slot และ Subscription', path: '/admin/runtime', icon: ServerCog },
  { label: 'Packages', description: 'ฟีเจอร์ ราคา และ Template', path: '/admin/packages', icon: PackageOpen },
]
const adminLinks: ToolLink[] = [
  { label: 'ภาพรวม', description: 'Dashboard สำหรับผู้ดูแล', path: '/admin', icon: CircleGauge },
  { label: 'ผู้ใช้', description: 'บัญชี สิทธิ์ และกระเป๋าเงิน', path: '/admin/users', icon: Users },
]
const navigationLinks: ToolLink[] = [
  { label: 'หน้าแรก', description: 'กลับสู่เว็บไซต์หลัก', path: '/', icon: House },
  { label: 'ผลงาน', description: 'Portfolio ทั้งหมด', path: '/work', icon: BriefcaseBusiness },
  { label: 'Store', description: 'แพ็กเกจและบริการ', path: '/store', icon: Store },
  { label: 'My Bot', description: 'บอทและ Runtime ของฉัน', path: '/my-bot', icon: Bot },
]
const groups: Array<{ id: ToolGroup; label: string; icon: LucideIcon }> = [
  { id: 'navigation', label: 'Navigate', icon: House },
  { id: 'work', label: 'Work', icon: BriefcaseBusiness },
  { id: 'bots', label: 'Bots', icon: Bot },
  { id: 'admin', label: 'Admin', icon: Settings2 },
]

const activeLinks = computed(() => {
  if (activeGroup.value === 'work') return workLinks
  if (activeGroup.value === 'bots') return botLinks
  if (activeGroup.value === 'admin') return adminLinks
  return navigationLinks
})
const groupTitle = computed(() => groups.find((group) => group.id === activeGroup.value)?.label ?? '')

function toggleGroup(group: ToolGroup) { activeGroup.value = activeGroup.value === group ? undefined : group; workPickerOpen.value = false }
function closeTools() { open.value = false; activeGroup.value = undefined; workPickerOpen.value = false }
function openLink(path: string) { closeTools(); void router.push(path) }
async function handleLink(link: ToolLink) {
  if (link.action !== 'pick-work') return openLink(link.path)
  workPickerOpen.value = true
  const session = authStore.session
  if (works.value.length || !session) return
  worksLoading.value = true
  worksError.value = ''
  try {
    works.value = await fetchAdminWorks(session)
  } catch (reason) {
    worksError.value = reason instanceof Error ? reason.message : 'Unable to load works.'
  } finally {
    worksLoading.value = false
  }
}
function editWork(id: string) { closeTools(); void router.push({ name: 'work-edit', params: { id } }) }
function workName(work: AdminWork) { return work.translations.find((translation) => translation.locale === 'th')?.name || work.translations.find((translation) => translation.locale === 'en')?.name || work.slug }
function isCurrentPath(path: string) {
  if (path === '/work') return route.path === path || /^\/work\/[^/]+\/edit$/.test(route.path)
  if (path === '/' || path === '/admin') return route.path === path
  return route.path === path || route.path.startsWith(`${path}/`)
}
function handleKeydown(event: KeyboardEvent) { if (event.key === 'Escape') closeTools() }

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <aside class="admin-tools" aria-label="Admin tools">
    <button v-if="!open" type="button" class="admin-tools__trigger" aria-label="เปิด Admin tools" @click="open = true">
      <Wrench aria-hidden="true" />
    </button>

    <template v-else>
      <nav class="admin-tools__bar" aria-label="Admin tool groups">
        <button type="button" class="admin-tools__close" aria-label="ปิด Admin tools" @click="closeTools"><X aria-hidden="true" /></button>
        <button v-for="group in groups" :key="group.id" type="button" class="admin-tools__group" :class="{ active: activeGroup === group.id }" :aria-label="group.label" :aria-expanded="activeGroup === group.id" @click="toggleGroup(group.id)">
          <component :is="group.icon" aria-hidden="true" />
          <span>{{ group.label }}</span>
        </button>
      </nav>

      <section v-if="activeGroup" class="admin-tools__panel" role="dialog" :aria-label="groupTitle">
        <header>
          <button v-if="workPickerOpen" type="button" class="admin-tools__back" aria-label="กลับไปเมนู Work" @click="workPickerOpen = false"><ArrowLeft aria-hidden="true" /></button>
          <div><span>ADMIN TOOLS</span><h2>{{ workPickerOpen ? 'Edit work' : groupTitle }}</h2></div>
        </header>
        <div v-if="!workPickerOpen" class="admin-tools__links">
          <button v-for="link in activeLinks" :key="`${link.path}-${link.label}`" type="button" class="admin-tools__link" :class="{ active: isCurrentPath(link.path) }" :aria-current="isCurrentPath(link.path) ? 'page' : undefined" @click="handleLink(link)">
            <span class="admin-tools__link-icon"><component :is="link.icon" aria-hidden="true" /></span>
            <span><strong>{{ link.label }}</strong><small>{{ link.description }}</small></span>
          </button>
        </div>
        <div v-else class="admin-tools__projects">
          <p v-if="worksLoading">กำลังโหลดผลงาน…</p>
          <p v-else-if="worksError" class="admin-tools__error">{{ worksError }}</p>
          <p v-else-if="!works.length">ยังไม่มีผลงานให้แก้ไข</p>
          <template v-else>
            <button v-for="work in works" :key="work.id" type="button" @click="editWork(work.id)">
              <span><strong>{{ workName(work) }}</strong><small>{{ work.slug }}</small></span>
              <small>{{ work.publicationStatus }}</small>
            </button>
          </template>
        </div>
      </section>
    </template>
  </aside>
</template>

<style scoped>
.admin-tools { position: fixed; z-index: 90; top: 50%; left: var(--space-md); transform: translateY(-50%); user-select: none; }
.admin-tools__trigger, .admin-tools__close, .admin-tools__group { display: grid; place-items: center; padding: 0; border: 0; cursor: pointer; }
.admin-tools__trigger { width: 3.75rem; height: 3.75rem; border: 1px solid color-mix(in srgb, var(--semantic-color-border-border-strong) 18%, transparent); border-radius: 50%; background: var(--semantic-color-action-backgrounds-bg-secondary); color: var(--semantic-color-action-text-text-on-secondary); box-shadow: 0 .65rem 1.8rem rgb(0 0 0 / 26%); transition: box-shadow 160ms ease, transform 160ms ease; }
.admin-tools__trigger:hover { box-shadow: 0 .85rem 2.2rem rgb(0 0 0 / 32%); transform: scale(1.05); }
.admin-tools__trigger:focus-visible { outline: 3px solid var(--semantic-color-action-borders-border-focus); outline-offset: 3px; }
.admin-tools__trigger svg { width: 1.4rem; height: 1.4rem; }
.admin-tools__bar { position: relative; z-index: 2; display: grid; width: 4.5rem; gap: var(--space-xs); justify-items: center; padding: var(--space-xs); border: 1px solid var(--semantic-color-border-border-default); border-radius: 999px; background: var(--semantic-color-action-backgrounds-bg-secondary); color: var(--semantic-color-action-text-text-on-secondary); box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 26%); animation: admin-bar-in 200ms cubic-bezier(.2,.8,.2,1) both; }
.admin-tools__close, .admin-tools__group { position: relative; width: 3.35rem; height: 3.35rem; border-radius: 50%; background: transparent; color: inherit; }
.admin-tools__close { background: var(--semantic-color-background-bg-default); color: var(--semantic-color-text-text-primary); }
.admin-tools__close svg, .admin-tools__group svg { width: 1.35rem; height: 1.35rem; }
.admin-tools__group:hover, .admin-tools__group:focus-visible, .admin-tools__group.active { background: var(--semantic-color-background-bg-default); color: var(--semantic-color-text-text-accent); outline: none; }
.admin-tools__group:focus-visible, .admin-tools__close:focus-visible { box-shadow: 0 0 0 3px var(--semantic-color-action-borders-border-focus); }
.admin-tools__group span { position: absolute; top: 50%; left: calc(100% + .65rem); padding: .3rem .55rem; border-radius: 999px; background: var(--semantic-color-action-backgrounds-bg-secondary); color: var(--semantic-color-action-text-text-on-secondary); font-size: .72rem; font-weight: 700; opacity: 0; pointer-events: none; transform: translate(.35rem, -50%); transition: opacity 140ms ease, transform 140ms ease; white-space: nowrap; }
.admin-tools__group:hover span, .admin-tools__group:focus-visible span { opacity: 1; transform: translate(0, -50%); }
.admin-tools__panel { position: absolute; z-index: 1; top: 50%; left: calc(100% + var(--space-sm)); display: grid; width: min(21rem, calc(100vw - 7.5rem)); max-height: min(32rem, calc(100vh - 2rem)); gap: var(--space-sm); padding: var(--space-lg); overflow-y: auto; border: 1px solid var(--semantic-color-border-border-default); border-radius: var(--corner-radius-xl); background: var(--semantic-color-background-bg-elevated); color: var(--semantic-color-text-text-primary); box-shadow: 0 1rem 3rem rgb(0 0 0 / 24%); transform: translateY(-50%); animation: admin-panel-in 180ms ease-out both; }
.admin-tools__panel header { display: flex; align-items: center; gap: var(--space-sm); padding: 0 var(--space-xs) var(--space-sm); border-bottom: 1px solid var(--semantic-color-border-border-subtle); }
.admin-tools__panel header > div { display: grid; gap: var(--space-xxs); }
.admin-tools__panel header span { color: var(--semantic-color-text-text-accent); font-size: .68rem; font-weight: 800; letter-spacing: .14em; }
.admin-tools__panel h2 { margin: 0; font-size: 1.45rem; }
.admin-tools__back { display: grid; width: 2.25rem; height: 2.25rem; flex: 0 0 auto; place-items: center; padding: 0; border: 1px solid var(--semantic-color-border-border-subtle); border-radius: 50%; background: var(--semantic-color-background-bg-surface); color: inherit; cursor: pointer; }
.admin-tools__back:hover, .admin-tools__back:focus-visible { background: var(--semantic-color-background-bg-surface-hover); outline: 2px solid var(--semantic-color-action-borders-border-focus); }
.admin-tools__back svg { width: 1rem; height: 1rem; }
.admin-tools__links { display: grid; gap: var(--space-xs); }
.admin-tools__link { position: relative; display: flex; min-height: 4.1rem; align-items: center; gap: var(--space-md); padding: var(--space-sm); border: 1px solid transparent; border-radius: var(--corner-radius-lg); background: transparent; color: inherit; text-align: left; cursor: pointer; }
.admin-tools__link:hover, .admin-tools__link:focus-visible { border-color: var(--semantic-color-border-border-subtle); background: var(--semantic-color-background-bg-surface-hover); outline: none; }
.admin-tools__link.active { background: color-mix(in srgb, var(--semantic-color-background-bg-accent) 10%, transparent); box-shadow: inset 3px 0 var(--semantic-color-text-text-accent); }
.admin-tools__link-icon { display: grid; width: 2.5rem; height: 2.5rem; flex: 0 0 auto; place-items: center; border-radius: var(--corner-radius-md); background: var(--semantic-color-background-bg-surface); color: var(--semantic-color-text-text-accent); }
.admin-tools__link-icon svg { width: 1.2rem; height: 1.2rem; }
.admin-tools__link > span:last-child { display: grid; min-width: 0; gap: var(--space-xxs); }
.admin-tools__link strong { font-size: .9rem; }
.admin-tools__link small { overflow: hidden; color: var(--semantic-color-text-text-muted); font-size: .75rem; text-overflow: ellipsis; white-space: nowrap; }
.admin-tools__projects { display: grid; gap: var(--space-xs); }
.admin-tools__projects > p { margin: 0; padding: var(--space-md); color: var(--semantic-color-text-text-muted); text-align: center; }
.admin-tools__projects > button { display: flex; min-height: 3.8rem; align-items: center; justify-content: space-between; gap: var(--space-sm); padding: var(--space-sm); border: 1px solid var(--semantic-color-border-border-subtle); border-radius: var(--corner-radius-lg); background: transparent; color: inherit; text-align: left; cursor: pointer; }
.admin-tools__projects > button:hover, .admin-tools__projects > button:focus-visible { background: var(--semantic-color-background-bg-surface-hover); outline: 2px solid var(--semantic-color-action-borders-border-focus); }
.admin-tools__projects > button > span { display: grid; min-width: 0; gap: var(--space-xxs); }
.admin-tools__projects strong, .admin-tools__projects small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-tools__projects small { color: var(--semantic-color-text-text-muted); font-size: .72rem; }
.admin-tools__error { color: var(--semantic-color-error-error-text) !important; }
@keyframes admin-bar-in { from { opacity: 0; transform: translateX(-1rem) scale(.92); } }
@keyframes admin-panel-in { from { opacity: 0; transform: translate(.75rem, -50%); } }
@media (max-width: 47.99rem) {
  .admin-tools { left: var(--space-sm); }
  .admin-tools__bar { width: 4rem; }
  .admin-tools__close, .admin-tools__group { width: 3rem; height: 3rem; }
  .admin-tools__panel { left: calc(100% + var(--space-xs)); width: calc(100vw - 5.75rem); padding: var(--space-md); }
}
@media (prefers-reduced-motion: reduce) { .admin-tools__bar, .admin-tools__panel { animation-duration: 1ms; } }
</style>
