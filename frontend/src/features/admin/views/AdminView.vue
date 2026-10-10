<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronRight } from 'lucide-vue-next'
import AdminNavigation from '../components/AdminNavigation.vue'
import { useAdminNavigation } from '../composables/useAdminNavigation'

const route = useRoute()
const { t } = useI18n()
const { items, destination } = useAdminNavigation()
const title = ref<HTMLHeadingElement>()
provide('admin-view-shell', true)

onMounted(() => document.documentElement.classList.add('admin-section-scroll'))
onBeforeUnmount(() => document.documentElement.classList.remove('admin-section-scroll'))
const section = computed(() => route.meta.adminSection ?? 'main')
const currentItem = computed(() => items.value.find((item) => item.id === section.value)!)

async function focusPageTitle() {
  await nextTick()
  title.value?.focus({ preventScroll: true })
}
</script>

<template>
  <main class="min-h-screen bg-bg-default pt-24 text-text-primary desktop:pt-28">
    <div class="page-container admin-shell-grid pb-5xl">
      <AdminNavigation @navigated="focusPageTitle" />
      <div class="min-w-0">
        <header class="admin-shell-header">
          <nav
            :aria-label="t('admin.breadcrumb.label')"
            class="flex flex-wrap items-center gap-xs text-label-medium text-text-secondary"
          >
            <RouterLink
              v-if="section !== 'main'"
              :to="destination('/admin')"
              class="rounded-sm hover:underline"
            >
              {{ t('admin.dashboard.mainTitle') }}
            </RouterLink>
            <span v-else>{{ t('admin.dashboard.mainTitle') }}</span>
            <ChevronRight class="size-icon-16" aria-hidden="true" />
            <span aria-current="page" class="font-medium text-text-primary">{{
              currentItem.title
            }}</span>
          </nav>
          <div
            class="flex flex-col gap-md tablet:flex-row tablet:items-start tablet:justify-between"
          >
            <div class="min-w-0 space-y-xs">
              <h1 ref="title" tabindex="-1" class="admin-shell-title text-heading-h1">
                {{ currentItem.title }}
              </h1>
              <p class="text-body-small text-text-secondary">{{ currentItem.description }}</p>
            </div>
            <div id="admin-toolbar-actions" class="admin-shell-actions"></div>
          </div>
        </header>

        <div class="admin-shell-content mt-xl">
          <RouterView v-slot="{ Component, route: childRoute }">
            <Transition name="admin-page" mode="out-in">
              <component :is="Component" :key="childRoute.path" />
            </Transition>
          </RouterView>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.admin-shell-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--space-lg);
}

.admin-shell-header {
  display: grid;
  gap: var(--space-md);
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-border-subtle);
}

.admin-shell-title {
  border-radius: var(--radius-sm);
}

.admin-shell-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.admin-shell-actions:empty {
  display: none;
}

@media (min-width: 64rem) {
  .admin-shell-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 4fr);
    gap: var(--space-xl);
  }
}

.admin-page-enter-active,
.admin-page-leave-active {
  transition: opacity 160ms ease;
}

.admin-page-enter-from,
.admin-page-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .admin-page-enter-active,
  .admin-page-leave-active {
    transition: none;
  }
}
</style>
