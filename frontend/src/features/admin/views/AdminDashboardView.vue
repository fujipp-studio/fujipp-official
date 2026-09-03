<script setup lang="ts">
import { computed, inject } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Users, Cpu, PackageOpen, Bot, HeartHandshake } from 'lucide-vue-next'
import AdminLayout from '../components/AdminLayout.vue'
import { AppSectionIndicator } from '../../../shared/ui'

const { t } = useI18n()
const embedded = inject('admin-view-shell', false)

const adminModules = computed(() => [
  {
    id: 'users',
    title: t('admin.dashboard.usersMenu'),
    icon: Users,
    path: '/admin/users',
  },
  {
    id: 'packages',
    title: t('admin.dashboard.packagesMenu'),
    icon: PackageOpen,
    path: '/admin/packages',
  },
  {
    id: 'runtime',
    title: t('admin.dashboard.runtimeMenu'),
    icon: Cpu,
    path: '/admin/runtime',
  },
  {
    id: 'bots',
    title: t('admin.dashboard.botsMenu'),
    icon: Bot,
    path: '/admin/bots',
  },
  {
    id: 'donations',
    title: t('admin.dashboard.donationsMenu'),
    icon: HeartHandshake,
    path: '/admin/donations',
  },
])
const sections = computed(() => [{ id: 'admin-main-menu', label: t('admin.breadcrumb.main') }])
</script>

<template>
  <AdminLayout>
    <div class="admin-main">
      <header v-if="!embedded" class="admin-main__header">
        <h1 class="text-4xl font-extrabold tracking-tight text-text-primary desktop:text-5xl">
          {{ t('admin.dashboard.mainTitle') }}
        </h1>
        <nav
          :aria-label="t('admin.breadcrumb.label')"
          class="flex min-h-11 items-center text-sm font-semibold text-text-primary"
        >
          <span aria-current="page">{{ t('admin.breadcrumb.main') }}</span>
        </nav>
      </header>

      <nav
        id="admin-main-menu"
        class="admin-menu-grid"
        :aria-label="t('admin.dashboard.modulesTitle')"
      >
        <RouterLink
          v-for="mod in adminModules"
          :key="mod.id"
          :to="mod.path"
          class="admin-menu-card"
        >
          <component :is="mod.icon" class="size-16" stroke-width="1.8" aria-hidden="true" />
          <span>{{ mod.title }}</span>
        </RouterLink>
      </nav>
      <AppSectionIndicator :sections="sections" :aria-label="t('admin.sections.navigation')" />
    </div>
  </AdminLayout>
</template>

<style scoped>
.admin-main {
  display: grid;
  gap: var(--spacing-xl);
}

.admin-main__header {
  display: grid;
  gap: var(--spacing-xl);
}

.admin-menu-grid {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-lg);
}

.admin-menu-card {
  display: flex;
  aspect-ratio: 1;
  width: 100%;
  max-width: 16rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.admin-menu-card:hover {
  border-color: var(--color-border-strong);
  background: var(--color-bg-surface-hover);
  transform: translateY(-2px);
}

.admin-menu-card:focus-visible {
  outline: 2px solid var(--color-border-accent);
  outline-offset: 3px;
}

@media (max-width: 479px) {
  .admin-menu-grid {
    gap: var(--spacing-md);
  }
}

@media (min-width: 64rem) {
  .admin-menu-grid {
    grid-template-columns: repeat(5, minmax(0, 16rem));
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-menu-card {
    transition: none;
  }
}
</style>
