<script setup lang="ts">
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  House,
  PackageOpen,
  Pencil,
  Plus,
  RefreshCw,
  ServerCog,
  Settings2,
  Wrench,
  type LucideIcon,
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { fetchAdminWorks, type AdminWork } from '@/features/work/api'
import { loadMessages } from '@/i18n'
import { AppButton, AppModal, AppTextField } from '../../../shared/ui'
import { useAuthStore } from '../../../stores'
import { useAdminNavigation } from '../composables/useAdminNavigation'

type ToolGroup = 'navigation' | 'work' | 'bots' | 'admin'
interface ToolLink {
  title: string
  description: string
  path: string
  icon: LucideIcon
  action?: 'pick-work'
}

const route = useRoute()
const auth = useAuthStore()
const { t, locale } = useI18n()
const { items: adminLinks, destination } = useAdminNavigation()
const dialogId = `admin-tools-${useId()}`
const trigger = ref<HTMLButtonElement>()
const ready = ref(false)
const open = ref(false)
const activeGroup = ref<ToolGroup>('navigation')
const workPickerOpen = ref(false)
const works = ref<AdminWork[]>([])
const worksLoading = ref(false)
const worksError = ref('')
const workQuery = ref('')
let requestVersion = 0

const canUseTools = computed(() => auth.currentUser?.role === 'ADMIN' && Boolean(auth.session))
const groups = computed(() => [
  { id: 'navigation' as const, title: t('admin.tools.navigate'), icon: House },
  { id: 'work' as const, title: t('admin.tools.work'), icon: BriefcaseBusiness },
  { id: 'bots' as const, title: t('admin.tools.bots'), icon: Bot },
  { id: 'admin' as const, title: t('admin.tools.admin'), icon: Settings2 },
])
const workLinks = computed<ToolLink[]>(() => [
  {
    title: t('admin.tools.addWork'),
    description: t('admin.tools.addWorkDescription'),
    path: '/work/add',
    icon: Plus,
  },
  {
    title: t('admin.tools.editWork'),
    description: t('admin.tools.editWorkDescription'),
    path: '/work',
    icon: Pencil,
    action: 'pick-work',
  },
])
const botLinks = computed<ToolLink[]>(() => [
  {
    title: t('admin.tools.myBots'),
    description: t('admin.tools.myBotsDescription'),
    path: '/my-bot',
    icon: Bot,
  },
  {
    title: t('admin.dashboard.botsMenu'),
    description: t('admin.nav.botsDesc'),
    path: '/admin/bots',
    icon: Bot,
  },
  {
    title: t('admin.dashboard.runtimeMenu'),
    description: t('admin.nav.runtimeDesc'),
    path: '/admin/runtime',
    icon: ServerCog,
  },
  {
    title: t('admin.dashboard.packagesMenu'),
    description: t('admin.tools.packagesDescription'),
    path: '/admin/packages',
    icon: PackageOpen,
  },
])
const navigationLinks = computed<ToolLink[]>(() => [
  {
    title: t('admin.tools.home'),
    description: t('admin.tools.homeDescription'),
    path: '/',
    icon: House,
  },
  {
    title: t('admin.tools.work'),
    description: t('admin.tools.workDescription'),
    path: '/work',
    icon: BriefcaseBusiness,
  },
  {
    title: t('admin.tools.store'),
    description: t('admin.tools.storeDescription'),
    path: '/store',
    icon: PackageOpen,
  },
  {
    title: t('admin.tools.myBots'),
    description: t('admin.tools.myBotsDescription'),
    path: '/my-bot',
    icon: Bot,
  },
])
const activeLinks = computed<ToolLink[]>(() => {
  if (activeGroup.value === 'work') return workLinks.value
  if (activeGroup.value === 'bots') return botLinks.value
  if (activeGroup.value === 'admin') return adminLinks.value
  return navigationLinks.value
})
const groupTitle = computed(
  () => groups.value.find((group) => group.id === activeGroup.value)!.title,
)
const filteredWorks = computed(() => {
  const query = workQuery.value.trim().toLocaleLowerCase()
  return works.value.filter((work) =>
    [work.slug, ...work.translations.map((translation) => translation.name)].some((value) =>
      value.toLocaleLowerCase().includes(query),
    ),
  )
})

onMounted(async () => {
  // Tools are also available on public routes, where the admin messages are not loaded yet.
  await Promise.all([loadMessages('en', ['admin']), loadMessages('th', ['admin'])])
  ready.value = true
})
onBeforeUnmount(cancelWorkRequest)
watch(() => route.fullPath, closeForNavigation)
watch(
  () => auth.session?.access_token,
  () => {
    closeForNavigation()
    works.value = []
  },
)
watch(canUseTools, (allowed) => {
  if (!allowed) closeForNavigation()
})

function cancelWorkRequest() {
  requestVersion++
  worksLoading.value = false
}
function closeForNavigation() {
  open.value = false
  cancelWorkRequest()
}
async function handleOpenChange(value: boolean) {
  open.value = value
  if (value) return
  cancelWorkRequest()
  await nextTick()
  trigger.value?.focus({ preventScroll: true })
}
function openTools() {
  activeGroup.value = route.path.startsWith('/admin')
    ? 'admin'
    : route.path.startsWith('/work')
      ? 'work'
      : route.path.startsWith('/my-bot')
        ? 'bots'
        : 'navigation'
  workPickerOpen.value = false
  open.value = true
}
function selectGroup(group: ToolGroup) {
  cancelWorkRequest()
  activeGroup.value = group
  workPickerOpen.value = false
  workQuery.value = ''
}
async function loadWorks() {
  const session = auth.session
  if (!session || !canUseTools.value || worksLoading.value) return
  const version = ++requestVersion
  worksLoading.value = true
  worksError.value = ''
  try {
    const result = await fetchAdminWorks(session)
    if (version === requestVersion) works.value = result
  } catch (reason) {
    if (version === requestVersion)
      worksError.value = reason instanceof Error ? reason.message : t('admin.tools.loadError')
  } finally {
    if (version === requestVersion) worksLoading.value = false
  }
}
function showWorkPicker() {
  workPickerOpen.value = true
  workQuery.value = ''
  works.value = []
  void loadWorks()
}
function workName(work: AdminWork) {
  return (
    work.translations.find((translation) => translation.locale === locale.value)?.name ||
    work.translations.find((translation) => translation.name)?.name ||
    work.slug
  )
}
function isCurrentPath(path: string) {
  if (path === '/' || path === '/admin') return route.path === path
  return route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
  <aside v-if="ready && canUseTools" class="admin-tools" :aria-label="t('admin.tools.title')">
    <button
      ref="trigger"
      type="button"
      class="admin-tools-trigger"
      :aria-label="t('admin.tools.open')"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="dialogId"
      @click="openTools"
    >
      <Wrench class="size-icon-24" aria-hidden="true" />
      <span class="text-label-medium font-semibold">{{ t('admin.tools.title') }}</span>
    </button>
    <AppModal
      :id="dialogId"
      :open="open"
      :title="t('admin.tools.title')"
      :subtitle="t('admin.tools.description')"
      class="admin-tools-dialog"
      @update:open="handleOpenChange"
    >
      <nav class="admin-tools-groups" :aria-label="t('admin.tools.groups')">
        <button
          v-for="group in groups"
          :key="group.id"
          type="button"
          class="admin-tools-group"
          :aria-pressed="activeGroup === group.id"
          :aria-controls="`${dialogId}-content`"
          @click="selectGroup(group.id)"
        >
          <component :is="group.icon" class="size-icon-24" aria-hidden="true" />
          <span class="text-label-small">{{ group.title }}</span>
        </button>
      </nav>
      <section
        :id="`${dialogId}-content`"
        class="mt-lg"
        :aria-label="workPickerOpen ? t('admin.tools.editWork') : groupTitle"
      >
        <div class="mb-sm flex items-center gap-xs">
          <button
            v-if="workPickerOpen"
            type="button"
            class="admin-tools-icon-button"
            :aria-label="t('admin.tools.back')"
            @click="selectGroup('work')"
          >
            <ArrowLeft class="size-icon-24" aria-hidden="true" />
          </button>
          <h3 class="flex-1 text-heading-h3 text-text-primary">
            {{ workPickerOpen ? t('admin.tools.editWork') : groupTitle }}
          </h3>
          <button
            v-if="workPickerOpen"
            type="button"
            class="admin-tools-icon-button"
            :disabled="worksLoading"
            :aria-label="t('admin.common.refresh')"
            @click="loadWorks"
          >
            <RefreshCw
              class="size-icon-16"
              :class="{ 'animate-spin motion-reduce:animate-none': worksLoading }"
              aria-hidden="true"
            />
          </button>
        </div>
        <div v-if="!workPickerOpen" class="grid gap-xs">
          <component
            :is="link.action ? 'button' : RouterLink"
            v-for="link in activeLinks"
            :key="link.path + link.title"
            :to="link.action ? undefined : destination(link.path)"
            :type="link.action ? 'button' : undefined"
            class="admin-tools-link"
            :class="{ 'admin-tools-link--active': !link.action && isCurrentPath(link.path) }"
            :aria-current="!link.action && isCurrentPath(link.path) ? 'page' : undefined"
            @click="link.action ? showWorkPicker() : closeForNavigation()"
          >
            <span class="rounded-md bg-bg-surface p-xs"
              ><component :is="link.icon" class="size-icon-24" aria-hidden="true"
            /></span>
            <span class="min-w-0 flex-1 space-y-xxs">
              <span class="block text-label-medium font-semibold text-text-primary">{{
                link.title
              }}</span>
              <span class="block text-body-small text-text-secondary">{{ link.description }}</span>
            </span>
            <ArrowUpRight class="size-icon-16 shrink-0" aria-hidden="true" />
          </component>
        </div>
        <div v-else class="space-y-sm" :aria-busy="worksLoading">
          <AppTextField
            v-model="workQuery"
            :label="t('admin.tools.searchWorks')"
            :placeholder="t('admin.tools.searchPlaceholder')"
          />
          <p v-if="worksLoading" class="py-lg text-center text-body-small" role="status">
            {{ t('admin.common.loading') }}
          </p>
          <div
            v-else-if="worksError"
            class="space-y-sm rounded-md border border-error-border bg-error-bg p-md"
          >
            <p role="alert" class="text-body-small text-error-text">{{ worksError }}</p>
            <AppButton @click="loadWorks">{{ t('admin.tools.retry') }}</AppButton>
          </div>
          <p v-else-if="!works.length" class="py-lg text-center text-body-small" role="status">
            {{ t('admin.tools.noWorks') }}
          </p>
          <p
            v-else-if="!filteredWorks.length"
            class="py-lg text-center text-body-small"
            role="status"
          >
            {{ t('admin.tools.noMatches') }}
          </p>
          <div v-else class="grid gap-xs">
            <RouterLink
              v-for="work in filteredWorks"
              :key="work.id"
              :to="{
                name: 'work-edit',
                params: { id: work.id },
                query: destination('/work').query,
              }"
              class="admin-tools-link"
              @click="closeForNavigation"
            >
              <span class="min-w-0 flex-1 space-y-xxs">
                <span class="block text-label-medium font-semibold text-text-primary">{{
                  workName(work)
                }}</span>
                <span class="block break-words text-body-small text-text-secondary">{{
                  work.slug
                }}</span>
              </span>
              <span
                class="rounded-full bg-bg-surface px-xs py-xxs text-label-small text-text-secondary"
                >{{
                  work.publicationStatus === 'PUBLISHED'
                    ? t('admin.tools.published')
                    : t('admin.tools.draft')
                }}</span
              >
              <Pencil class="size-icon-16 shrink-0" aria-hidden="true" />
            </RouterLink>
          </div>
        </div>
      </section>
    </AppModal>
  </aside>
</template>

<style scoped>
.admin-tools {
  position: fixed;
  z-index: var(--z-raised);
  left: var(--space-md);
  bottom: max(var(--space-md), env(safe-area-inset-bottom));
}
.admin-tools-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-full);
  background: var(--semantic-color-action-backgrounds-bg-secondary);
  color: var(--semantic-color-action-text-text-on-secondary);
  box-shadow: var(--effect-shadow-lg);
  cursor: pointer;
  transition: background-color 160ms ease;
}
.admin-tools-trigger:hover {
  background: var(--semantic-color-action-backgrounds-bg-secondary-hover);
}
.admin-tools-dialog.app-modal {
  width: min(calc(100% - var(--space-md) * 2), calc(var(--layout-reading-max-width) / 2));
  margin: auto auto max(var(--space-md), env(safe-area-inset-bottom)) var(--space-md);
  border-radius: var(--corner-radius-lg);
}
.admin-tools-dialog :deep(.app-modal__title) {
  font-size: var(--font-size-heading-h2);
}
.admin-tools-dialog :deep(.app-modal__header) {
  padding: var(--space-md);
}
.admin-tools-dialog :deep(.app-modal__body) {
  padding: 0 var(--space-md) var(--space-md);
}
.admin-tools-groups {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-xxs);
  padding: var(--space-xxs);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-lg);
  background: var(--semantic-color-background-bg-surface);
}
.admin-tools-group {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-xxs);
  border-radius: var(--corner-radius-md);
  color: var(--semantic-color-text-text-secondary);
  cursor: pointer;
}
.admin-tools-group[aria-pressed='true'] {
  background: var(--semantic-color-action-backgrounds-bg-secondary);
  color: var(--semantic-color-action-text-text-on-secondary);
}
.admin-tools-group:hover:not([aria-pressed='true']) {
  background: var(--semantic-color-background-bg-surface-hover);
}
.admin-tools-link {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-md);
  color: var(--semantic-color-text-text-secondary);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.admin-tools-link:hover,
.admin-tools-link--active {
  border-color: var(--semantic-color-border-border-default);
  background: var(--semantic-color-background-bg-surface-hover);
}
.admin-tools-icon-button {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  padding: var(--space-xs);
  border-radius: var(--corner-radius-md);
  color: var(--semantic-color-text-text-primary);
  cursor: pointer;
}
.admin-tools-icon-button:hover {
  background: var(--semantic-color-background-bg-surface-hover);
}
.admin-tools-icon-button:disabled {
  cursor: wait;
  opacity: 0.5;
}
@media (prefers-reduced-motion: reduce) {
  .admin-tools-trigger {
    transition: none;
  }
}
</style>
