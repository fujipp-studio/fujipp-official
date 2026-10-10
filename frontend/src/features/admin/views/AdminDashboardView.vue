<script setup lang="ts">
import { inject } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowUpRight } from 'lucide-vue-next'
import AdminLayout from '../components/AdminLayout.vue'
import { useAdminNavigation } from '../composables/useAdminNavigation'

const { t } = useI18n()
const embedded = inject('admin-view-shell', false)
const { modules, destination } = useAdminNavigation()
</script>

<template>
  <AdminLayout>
    <div class="space-y-lg">
      <header v-if="!embedded" class="space-y-xs">
        <h1 class="text-heading-h1">{{ t('admin.dashboard.mainTitle') }}</h1>
        <p class="text-body-small text-text-secondary">
          {{ t('admin.navigation.overviewDescription') }}
        </p>
      </header>
      <h2 id="admin-menu-title" class="text-heading-h3">{{ t('admin.dashboard.modulesTitle') }}</h2>
      <nav
        id="admin-main-menu"
        class="grid grid-cols-1 gap-md tablet:grid-cols-2"
        aria-labelledby="admin-menu-title"
      >
        <RouterLink
          v-for="mod in modules"
          :key="mod.id"
          :to="destination(mod.path)"
          class="admin-menu-card group"
          :aria-labelledby="`admin-menu-${mod.id}`"
        >
          <div class="flex items-start justify-between gap-md">
            <span class="rounded-md border border-border-subtle bg-bg-default p-sm">
              <component
                :is="mod.icon"
                class="size-icon-24"
                stroke-width="1.8"
                aria-hidden="true"
              />
            </span>
            <ArrowUpRight class="size-icon-24 text-text-secondary" aria-hidden="true" />
          </div>
          <div class="space-y-xs">
            <h3 :id="`admin-menu-${mod.id}`" class="text-heading-h3">{{ mod.title }}</h3>
            <p class="text-body-small text-text-secondary">{{ mod.description }}</p>
          </div>
          <span class="mt-auto text-label-medium font-semibold group-hover:underline">
            {{ t('admin.dashboard.enterPanel') }}
          </span>
        </RouterLink>
      </nav>
    </div>
  </AdminLayout>
</template>

<style scoped>
.admin-menu-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  text-decoration: none;
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}

.admin-menu-card:hover {
  border-color: var(--color-border-strong);
  background: var(--color-bg-surface-hover);
}

@media (prefers-reduced-motion: reduce) {
  .admin-menu-card {
    transition: none;
  }
}
</style>
