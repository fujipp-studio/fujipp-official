<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Menu, ShieldCheck, X } from 'lucide-vue-next'
import { useAdminNavigation } from '../composables/useAdminNavigation'

const emit = defineEmits<{ navigated: [] }>()
const route = useRoute()
const { t } = useI18n()
const { items, destination } = useAdminNavigation()
const open = ref(false)
const toggle = ref<HTMLButtonElement>()

watch(
  () => route.path,
  () => {
    if (!open.value) return
    open.value = false
    emit('navigated')
  },
)

function closeMenu() {
  if (!open.value) return
  open.value = false
  toggle.value?.focus()
}
</script>

<template>
  <aside class="admin-navigation" @keydown.esc="closeMenu">
    <div class="hidden items-center gap-sm p-md desktop:flex">
      <span class="flex rounded-md bg-bg-default p-xs">
        <ShieldCheck class="size-icon-24" aria-hidden="true" />
      </span>
      <div class="min-w-0">
        <p class="text-label-large font-semibold">{{ t('admin.dashboard.mainTitle') }}</p>
        <p class="mt-xxs text-label-small text-text-secondary">Fujipp Official</p>
      </div>
    </div>
    <button
      ref="toggle"
      type="button"
      class="admin-navigation-toggle flex w-full items-center gap-sm rounded-lg p-md text-label-large font-semibold desktop:hidden"
      :aria-expanded="open"
      aria-controls="admin-navigation-links"
      @click="open = !open"
    >
      <component :is="open ? X : Menu" class="size-icon-24" aria-hidden="true" />
      <span class="flex-1 text-left">{{ t('admin.navigation.menu') }}</span>
      <ChevronDown
        class="size-icon-16 transition-transform motion-reduce:transition-none"
        :class="{ 'rotate-180': open }"
        aria-hidden="true"
      />
    </button>
    <nav
      id="admin-navigation-links"
      class="admin-navigation-links"
      :class="{ 'admin-navigation-links--open': open }"
      :aria-label="t('admin.navigation.label')"
    >
      <RouterLink
        v-for="item in items"
        :key="item.id"
        :to="destination(item.path)"
        class="admin-navigation-link"
        :class="{
          'admin-navigation-link--active': (route.meta.adminSection ?? 'main') === item.id,
        }"
        :aria-current="(route.meta.adminSection ?? 'main') === item.id ? 'page' : undefined"
        @click="item.path === route.path && closeMenu()"
      >
        <component :is="item.icon" class="size-icon-24 shrink-0" aria-hidden="true" />
        <span>{{ item.title }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>

<style scoped>
.admin-navigation {
  align-self: start;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
}

.admin-navigation-toggle:hover {
  background: var(--color-bg-surface-hover);
}

.admin-navigation-links {
  display: none;
  gap: var(--space-xxs);
  padding: var(--space-xs);
}

.admin-navigation-links--open {
  display: grid;
}

.admin-navigation-link {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-label-medium);
  font-weight: var(--typography-font-weight-medium);
  text-decoration: none;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.admin-navigation-link:hover {
  background: var(--color-bg-surface-hover);
  color: var(--color-text-primary);
}

.admin-navigation-link--active {
  background: var(--color-action-bg-secondary);
  color: var(--color-action-text-on-secondary);
}

.admin-navigation-link--active:hover {
  background: var(--color-action-bg-secondary-hover);
  color: var(--color-action-text-on-secondary);
}

@media (min-width: 64rem) {
  .admin-navigation {
    position: sticky;
    top: calc(var(--space-4xl) + var(--space-md));
    max-height: calc(100dvh - var(--space-4xl) - var(--space-2xl));
    overflow-y: auto;
  }

  .admin-navigation-links {
    display: grid;
    border-top: 1px solid var(--color-border-subtle);
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-navigation-link {
    transition: none;
  }
}
</style>
