<script setup lang="ts">
import {
  Bot,
  BriefcaseBusiness,
  ChevronLeft,
  CircleGauge,
  House,
  PackageOpen,
  Plus,
  ServerCog,
  Settings2,
  Store,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

type ToolLevel = 'closed' | 'categories' | 'content' | 'admin' | 'navigation'
interface ToolLink {
  label: string
  description: string
  path: string
  icon: LucideIcon
}

const POSITION_KEY = 'fujipp-admin-tools-position'
const router = useRouter()
const level = ref<ToolLevel>('closed')
const position = ref({ x: 0, y: 0 })
const viewport = ref({ width: 0, height: 0 })
const dragging = ref(false)
let pointerId: number | null = null
let dragOrigin = { pointerX: 0, pointerY: 0, x: 0, y: 0 }
let didDrag = false
let closedPosition: { x: number; y: number } | null = null

const contentLinks: ToolLink[] = [
  { label: 'เพิ่มผลงาน', description: 'สร้าง Portfolio รายการใหม่', path: '/work/add', icon: Plus },
  { label: 'จัดการผลงาน', description: 'ดูและแก้ไขรายการ Portfolio', path: '/work', icon: BriefcaseBusiness },
  { label: 'หน้าร้าน', description: 'ตรวจสอบ Store ที่ผู้ใช้เห็น', path: '/store', icon: Store },
  { label: 'บอทของฉัน', description: 'เปิดหน้าจัดการบอทและแพ็กเกจ', path: '/my-bot', icon: Bot },
]
const adminLinks: ToolLink[] = [
  { label: 'ภาพรวม', description: 'Dashboard สำหรับผู้ดูแล', path: '/admin', icon: CircleGauge },
  { label: 'ผู้ใช้', description: 'บัญชี สิทธิ์ และกระเป๋าเงิน', path: '/admin/users', icon: Users },
  { label: 'Runtime', description: 'แผน Slot และ Subscription', path: '/admin/runtime', icon: ServerCog },
  { label: 'Packages', description: 'ฟีเจอร์ ราคา และ Template', path: '/admin/packages', icon: PackageOpen },
  { label: 'Bots', description: 'ตรวจสอบและจัดการบอททั้งหมด', path: '/admin/bots', icon: Bot },
]
const navigationLinks: ToolLink[] = [
  { label: 'หน้าแรก', description: 'กลับสู่เว็บไซต์หลัก', path: '/', icon: House },
  { label: 'ผลงาน', description: 'Portfolio ทั้งหมด', path: '/work', icon: BriefcaseBusiness },
  { label: 'Store', description: 'แพ็กเกจและบริการ', path: '/store', icon: Store },
  { label: 'My Bot', description: 'บอทและ Runtime ของฉัน', path: '/my-bot', icon: Bot },
]
const activeLinks = computed(() => {
  if (level.value === 'content') return contentLinks
  if (level.value === 'admin') return adminLinks
  if (level.value === 'navigation') return navigationLinks
  return []
})
const pickerTitle = computed(() => {
  if (level.value === 'content') return 'Content tools'
  if (level.value === 'admin') return 'Admin workspace'
  return 'Navigation'
})
const positionStyle = computed(() => ({ left: `${position.value.x}px`, top: `${position.value.y}px` }))
const pickerOnLeft = computed(() => position.value.x > viewport.value.width / 2)
const pickerOnTop = computed(() => position.value.y > viewport.value.height / 2)

function clampPosition(x: number, y: number) {
  const width = viewport.value.width || window.innerWidth
  const height = viewport.value.height || window.innerHeight
  const radius = level.value === 'closed' ? 36 : Math.max(124, Math.min(140, width / 2 - 12, height / 2 - 12))
  return {
    x: Math.min(Math.max(x, radius), width - radius),
    y: Math.min(Math.max(y, radius), height - radius),
  }
}

function setLevel(next: ToolLevel) {
  if (level.value === 'closed' && next !== 'closed') closedPosition = { ...position.value }
  level.value = next
  if (next === 'closed' && closedPosition) {
    position.value = clampPosition(closedPosition.x, closedPosition.y)
    closedPosition = null
  } else position.value = clampPosition(position.value.x, position.value.y)
}

function handleCenter() {
  if (didDrag) {
    didDrag = false
    return
  }
  if (level.value === 'closed') setLevel('categories')
  else if (level.value === 'categories') setLevel('closed')
  else setLevel('categories')
}

function openLink(path: string) {
  setLevel('closed')
  void router.push(path)
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0 || level.value !== 'closed') return
  pointerId = event.pointerId
  dragOrigin = { pointerX: event.clientX, pointerY: event.clientY, ...position.value }
  didDrag = false
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  if (pointerId !== event.pointerId) return
  const deltaX = event.clientX - dragOrigin.pointerX
  const deltaY = event.clientY - dragOrigin.pointerY
  if (Math.hypot(deltaX, deltaY) > 5) {
    didDrag = true
    dragging.value = true
  }
  if (dragging.value) position.value = clampPosition(dragOrigin.x + deltaX, dragOrigin.y + deltaY)
}

function endDrag(event: PointerEvent) {
  if (pointerId !== event.pointerId) return
  pointerId = null
  dragging.value = false
  localStorage.setItem(POSITION_KEY, JSON.stringify(position.value))
}

function syncViewport() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
  position.value = clampPosition(position.value.x, position.value.y)
}

onMounted(() => {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
  const fallback = { x: window.innerWidth - 52, y: window.innerHeight - 52 }
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null') as { x?: number; y?: number } | null
    position.value = clampPosition(saved?.x ?? fallback.x, saved?.y ?? fallback.y)
  } catch {
    position.value = clampPosition(fallback.x, fallback.y)
  }
  window.addEventListener('resize', syncViewport, { passive: true })
})

onBeforeUnmount(() => window.removeEventListener('resize', syncViewport))
</script>

<template>
  <aside
    class="admin-tools"
    :class="{
      'admin-tools--open': level !== 'closed',
      'admin-tools--dragging': dragging,
      'admin-tools--picker-left': pickerOnLeft,
      'admin-tools--picker-top': pickerOnTop,
    }"
    :style="positionStyle"
    aria-label="Admin tools"
  >
    <section
      v-if="activeLinks.length"
      class="admin-tools__picker"
      role="dialog"
      :aria-label="pickerTitle"
    >
      <header class="admin-tools__picker-header">
        <div>
          <span>ADMIN TOOLS</span>
          <strong>{{ pickerTitle }}</strong>
        </div>
        <button type="button" aria-label="กลับไปเลือกหมวดหมู่" @click="setLevel('categories')">
          <ChevronLeft aria-hidden="true" />
        </button>
      </header>
      <button
        v-for="link in activeLinks"
        :key="link.path"
        type="button"
        class="admin-tools__link"
        @click="openLink(link.path)"
      >
        <span class="admin-tools__link-icon"><component :is="link.icon" aria-hidden="true" /></span>
        <span><strong>{{ link.label }}</strong><small>{{ link.description }}</small></span>
      </button>
    </section>

    <div class="admin-tools__radial" :class="`admin-tools__radial--${level}`">
      <div v-if="level !== 'closed'" class="admin-tools__ring" aria-hidden="true" />
      <template v-if="level === 'categories'">
        <button type="button" class="admin-tools__segment admin-tools__segment--top" aria-label="เครื่องมือ Content" @click="setLevel('content')">
          <BriefcaseBusiness aria-hidden="true" /><span>Content</span>
        </button>
        <button type="button" class="admin-tools__segment admin-tools__segment--right" aria-label="Admin workspace" @click="setLevel('admin')">
          <Settings2 aria-hidden="true" /><span>Admin</span>
        </button>
        <button type="button" class="admin-tools__segment admin-tools__segment--left" aria-label="เมนูนำทาง" @click="setLevel('navigation')">
          <House aria-hidden="true" /><span>Navigate</span>
        </button>
      </template>
      <button
        type="button"
        class="admin-tools__trigger"
        :aria-expanded="level !== 'closed'"
        :aria-label="level === 'closed' ? 'เปิด Admin tools; ลากเพื่อย้ายตำแหน่ง' : level === 'categories' ? 'ปิด Admin tools' : 'กลับไปเลือกหมวดหมู่'"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @click="handleCenter"
      >
        <X v-if="level === 'categories'" aria-hidden="true" />
        <ChevronLeft v-else-if="level !== 'closed'" aria-hidden="true" />
        <Wrench v-else aria-hidden="true" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.admin-tools { position: fixed; z-index: 90; width: 3.5rem; height: 3.5rem; transform: translate(-50%, -50%); touch-action: none; user-select: none; }
.admin-tools--open { width: 17.5rem; height: 17.5rem; }
.admin-tools__radial { position: absolute; top: 50%; left: 50%; width: 3.5rem; height: 3.5rem; transform: translate(-50%, -50%); }
.admin-tools--open .admin-tools__radial { width: 17.5rem; height: 17.5rem; }
.admin-tools__ring { position: absolute; inset: 0; border: 1px solid var(--semantic-color-border-border-default); border-radius: 50%; background: conic-gradient(from 300deg, var(--semantic-color-background-bg-elevated) 0deg 119deg, var(--semantic-color-border-border-subtle) 119deg 120deg, var(--semantic-color-background-bg-elevated) 120deg 239deg, var(--semantic-color-border-border-subtle) 239deg 240deg, var(--semantic-color-background-bg-elevated) 240deg 359deg, var(--semantic-color-border-border-subtle) 359deg 360deg); box-shadow: 0 1.1rem 3.2rem rgb(0 0 0 / 24%); opacity: 0; transform: scale(.35) rotate(-50deg); animation: tools-open 280ms cubic-bezier(.2,.85,.25,1.2) forwards; }
.admin-tools__ring::after { position: absolute; inset: 5.35rem; border: 1px solid var(--semantic-color-border-border-subtle); border-radius: 50%; background: color-mix(in srgb, var(--semantic-color-background-bg-default) 45%, transparent); backdrop-filter: blur(.5rem); content: ''; }
.admin-tools__trigger { position: absolute; top: 50%; left: 50%; z-index: 5; display: grid; width: 3.65rem; height: 3.65rem; place-items: center; padding: 0; border: 1px solid color-mix(in srgb, var(--semantic-color-border-border-strong) 18%, transparent); border-radius: 50%; background: var(--semantic-color-action-backgrounds-bg-secondary); color: var(--semantic-color-action-text-text-on-secondary); box-shadow: 0 .55rem 1.5rem rgb(0 0 0 / 28%), 0 0 0 .35rem color-mix(in srgb, var(--semantic-color-background-bg-default) 72%, transparent); cursor: grab; transform: translate(-50%, -50%); transition: box-shadow 160ms ease, transform 160ms ease, background 160ms ease; touch-action: none; }
.admin-tools__trigger:hover { box-shadow: 0 .75rem 2rem rgb(0 0 0 / 32%); transform: translate(-50%, -50%) scale(1.06); }
.admin-tools__trigger:focus-visible { outline: 3px solid var(--semantic-color-action-borders-border-focus); outline-offset: 3px; }
.admin-tools--open .admin-tools__trigger { background: var(--semantic-color-action-backgrounds-bg-secondary); cursor: pointer; }
.admin-tools--dragging .admin-tools__trigger { cursor: grabbing; transform: translate(-50%, -50%) scale(.94); }
.admin-tools__trigger svg { width: 1.35rem; height: 1.35rem; }
.admin-tools__segment { position: absolute; inset: 0; z-index: 3; width: 100%; height: 100%; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--semantic-color-text-text-secondary); cursor: pointer; opacity: 0; transform: scale(.4); animation: tool-pill-open 260ms cubic-bezier(.2,.85,.25,1.2) forwards; transition: color 160ms ease; }
.admin-tools__segment::before { position: absolute; inset: 0; z-index: 1; border-radius: 50%; background: transparent; content: ''; mask: radial-gradient(circle, transparent 0 3.3rem, #000 3.4rem); transition: background-color 160ms ease; }
.admin-tools__segment:hover, .admin-tools__segment:focus-visible { color: var(--semantic-color-text-text-primary); outline: none; }
.admin-tools__segment:hover::before { background: color-mix(in srgb, var(--semantic-color-background-bg-accent) 12%, transparent); }
.admin-tools__segment:focus-visible::before { background: color-mix(in srgb, var(--semantic-color-background-bg-accent) 10%, transparent); box-shadow: inset 0 0 0 2px var(--semantic-color-action-borders-border-focus); }
.admin-tools__segment svg, .admin-tools__segment span { position: absolute; z-index: 2; left: 50%; pointer-events: none; transform: translateX(-50%); }
.admin-tools__segment svg { width: 1.65rem; height: 1.65rem; color: var(--semantic-color-text-text-accent); }
.admin-tools__segment span { font-size: .8rem; font-weight: 700; }
.admin-tools__segment--top { clip-path: polygon(50% 50%, 7% 0, 93% 0); animation-delay: 30ms; }
.admin-tools__segment--right { clip-path: polygon(50% 50%, 93% 0, 100% 7%, 100% 100%, 50% 100%); animation-delay: 60ms; }
.admin-tools__segment--left { clip-path: polygon(50% 50%, 50% 100%, 0 100%, 0 7%, 7% 0); animation-delay: 90ms; }
.admin-tools__segment--top svg { top: 10%; }
.admin-tools__segment--top span { top: 25%; }
.admin-tools__segment--right svg { top: 55%; left: 77%; }
.admin-tools__segment--right span { top: 70%; left: 77%; }
.admin-tools__segment--left svg { top: 55%; left: 23%; }
.admin-tools__segment--left span { top: 70%; left: 23%; }
.admin-tools__picker { position: absolute; top: 0; left: calc(50% + 9.9rem); z-index: 8; display: grid; box-sizing: border-box; width: min(21rem, calc(100vw - 2rem)); max-height: min(30rem, calc(100vh - 2rem)); gap: .35rem; padding: 1rem; overflow: auto; border: 1px solid var(--semantic-color-border-border-default); border-radius: 1rem; background: var(--semantic-color-background-bg-elevated); color: var(--semantic-color-text-text-primary); box-shadow: 0 1rem 3rem rgb(0 0 0 / 24%); animation: picker-open 200ms ease-out both; touch-action: pan-y; }
.admin-tools--picker-top .admin-tools__picker { top: auto; bottom: 0; }
.admin-tools--picker-left .admin-tools__picker { right: calc(50% + 9.9rem); left: auto; }
.admin-tools__picker-header { display: flex; align-items: center; justify-content: space-between; padding: .25rem .25rem .75rem; }
.admin-tools__picker-header div { display: grid; gap: .15rem; }
.admin-tools__picker-header span { color: var(--semantic-color-text-text-accent); font-size: .65rem; font-weight: 800; letter-spacing: .12em; }
.admin-tools__picker-header strong { font-size: 1rem; }
.admin-tools__picker-header button { display: grid; width: 2rem; height: 2rem; place-items: center; border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; }
.admin-tools__picker-header button:hover, .admin-tools__picker-header button:focus-visible { background: var(--semantic-color-background-bg-surface-hover); outline: 2px solid var(--semantic-color-action-borders-border-focus); }
.admin-tools__picker-header svg { width: 1rem; }
.admin-tools__link { display: flex; min-height: 3.6rem; align-items: center; gap: .75rem; padding: .55rem .65rem; border: 1px solid transparent; border-radius: .75rem; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.admin-tools__link:hover, .admin-tools__link:focus-visible { border-color: var(--semantic-color-border-border-subtle); background: var(--semantic-color-background-bg-surface-hover); outline: none; }
.admin-tools__link-icon { display: grid; width: 2.35rem; height: 2.35rem; flex: 0 0 auto; place-items: center; border-radius: .65rem; background: var(--semantic-color-background-bg-surface); color: var(--semantic-color-text-text-accent); }
.admin-tools__link-icon svg { width: 1.1rem; height: 1.1rem; }
.admin-tools__link > span:last-child { display: grid; gap: .1rem; }
.admin-tools__link strong { font-size: .85rem; }
.admin-tools__link small { color: var(--semantic-color-text-text-muted); font-size: .72rem; }
@keyframes tools-open { to { opacity: 1; transform: scale(1) rotate(0); } }
@keyframes tool-pill-open { to { opacity: 1; transform: scale(1); } }
@keyframes picker-open { from { opacity: 0; transform: translateX(1rem); } }
@media (max-width: 47.99rem) {
  .admin-tools--open, .admin-tools--open .admin-tools__radial { width: 15.5rem; height: 15.5rem; }
  .admin-tools__ring::after { inset: 4.65rem; }
  .admin-tools__segment svg { width: 1.4rem; height: 1.4rem; }
  .admin-tools__segment span { font-size: .72rem; }
  .admin-tools__picker, .admin-tools--picker-left .admin-tools__picker { top: calc(100% + .75rem); right: auto; bottom: auto; left: 50%; max-height: min(20rem, calc(100vh - 2rem)); transform: translateX(-50%); }
  .admin-tools--picker-top .admin-tools__picker { top: auto; bottom: calc(100% + .75rem); }
  @keyframes picker-open { from { opacity: 0; transform: translate(-50%, .75rem); } }
}
@media (prefers-reduced-motion: reduce) { .admin-tools__ring, .admin-tools__segment, .admin-tools__picker { animation-duration: 1ms; } }
</style>
