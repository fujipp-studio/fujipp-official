<script setup lang="ts">
import { inject, nextTick, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AppButton } from '../../../shared/ui'

defineProps<{ title: string; description: string; icon: Component }>()
const { t } = useI18n()
const embedded = inject('admin-view-shell', false)
const toolbarReady = ref(false)

onMounted(async () => {
  if (!embedded) return
  await nextTick()
  toolbarReady.value = true
})
</script>

<template>
  <Teleport v-if="embedded && toolbarReady" to="#admin-toolbar-actions">
    <slot name="actions" />
  </Teleport>
  <span v-else-if="embedded" class="sr-only">{{ title }}</span>
  <header v-else class="admin-store-header">
    <div class="admin-store-title-row">
      <h1 class="text-4xl font-extrabold tracking-tight text-text-primary desktop:text-5xl">
        {{ title }}
      </h1>
      <AppButton class="tablet:!w-auto" @click="$router.push('/admin')">
        {{ t('admin.breadcrumb.back') }}
      </AppButton>
    </div>
    <div class="admin-store-toolbar">
      <nav :aria-label="t('admin.breadcrumb.label')" class="admin-store-breadcrumb">
        <RouterLink to="/admin" class="admin-store-breadcrumb-link">
          {{ t('admin.breadcrumb.main') }}
        </RouterLink>
        <span class="admin-store-breadcrumb-tail">
          <span aria-hidden="true">&gt;</span>
          <span aria-current="page">{{ title }}</span>
        </span>
      </nav>
      <div class="flex flex-wrap items-center gap-xs"><slot name="actions" /></div>
    </div>
    <p class="sr-only">{{ description }}</p>
  </header>
</template>

<style scoped>
.admin-store-header {
  display: grid;
  gap: var(--spacing-xl);
}

.admin-store-title-row {
  display: flex;
  min-height: 3.5rem;
  flex-direction: column;
  gap: var(--spacing-md);
}

.admin-store-toolbar {
  display: flex;
  min-height: 2.75rem;
  flex-direction: column;
  gap: var(--spacing-md);
}

.admin-store-breadcrumb {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.admin-store-breadcrumb-link {
  color: inherit;
  text-decoration: none;
}

.admin-store-breadcrumb-link:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.admin-store-breadcrumb-link:focus-visible {
  border-radius: var(--radius-xs);
  outline: 2px solid var(--color-border-accent);
  outline-offset: 3px;
}

.admin-store-breadcrumb-tail {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  animation: breadcrumb-slide 220ms ease-out both;
}

@keyframes breadcrumb-slide {
  from {
    opacity: 0;
    transform: translateX(-0.4rem);
  }
}

@media (min-width: 48rem) {
  .admin-store-title-row,
  .admin-store-toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-store-breadcrumb-tail {
    animation: none;
  }
}
</style>
