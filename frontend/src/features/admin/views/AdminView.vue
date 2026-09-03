<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { AppButton } from '../../../shared/ui'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
provide('admin-view-shell', true)

onMounted(() => document.documentElement.classList.add('admin-section-scroll'))
onBeforeUnmount(() => document.documentElement.classList.remove('admin-section-scroll'))
const section = computed(() => route.meta.adminSection ?? 'main')
const transitionName = ref('admin-forward')
const sectionScrollY = ref(0)

const sectionLabel = computed(() => {
  if (section.value === 'users') return t('admin.dashboard.usersMenu')
  if (section.value === 'packages') return t('admin.dashboard.packagesMenu')
  if (section.value === 'runtime') return t('admin.dashboard.runtimeMenu')
  if (section.value === 'bots') return t('admin.dashboard.botsMenu')
  if (section.value === 'donations') return t('admin.dashboard.donationsMenu')
  return ''
})

watch(section, (nextSection, previous) => {
  if (nextSection === previous) return
  sectionScrollY.value = window.scrollY
  transitionName.value = nextSection === 'main' ? 'admin-backward' : 'admin-forward'
  void nextTick(restoreSectionPosition)
})

function restoreSectionPosition() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: sectionScrollY.value, behavior: 'instant' })
    })
  })
}
</script>

<template>
  <main class="admin-view-shell min-h-screen bg-bg-default pt-24 text-text-primary desktop:pt-28">
    <div class="page-container pb-5xl">
      <header class="admin-shell-header">
        <div class="admin-shell-title-row">
          <h1 class="text-4xl font-extrabold tracking-tight text-text-primary desktop:text-5xl">
            {{ t('admin.dashboard.mainTitle') }}
          </h1>
          <AppButton
            v-if="section !== 'main'"
            class="tablet:!w-auto"
            @click="router.push('/admin')"
          >
            {{ t('admin.breadcrumb.back') }}
          </AppButton>
        </div>
        <div class="admin-shell-toolbar">
          <nav :aria-label="t('admin.breadcrumb.label')" class="admin-shell-breadcrumb">
            <button
              v-if="section !== 'main'"
              type="button"
              class="admin-shell-breadcrumb-link"
              @click="router.push('/admin')"
            >
              {{ t('admin.breadcrumb.main') }}
            </button>
            <span v-else>{{ t('admin.breadcrumb.main') }}</span>
            <span v-if="section !== 'main'" class="admin-shell-breadcrumb-tail">
              <span aria-hidden="true">&gt;</span>
              <span aria-current="page">{{ sectionLabel }}</span>
            </span>
          </nav>
          <div id="admin-toolbar-actions" class="flex flex-wrap items-center gap-xs"></div>
        </div>
      </header>

      <div class="admin-shell-content">
        <RouterView v-slot="{ Component, route: childRoute }">
          <Transition :name="transitionName" mode="out-in" @after-enter="restoreSectionPosition">
            <component :is="Component" :key="childRoute.path" />
          </Transition>
        </RouterView>
      </div>
    </div>
  </main>
</template>

<style scoped>
.admin-view-shell {
  overflow: hidden;
}

.admin-shell-header {
  display: grid;
  gap: var(--spacing-xl);
}

.admin-shell-title-row,
.admin-shell-toolbar {
  display: flex;
  min-height: 3.5rem;
  flex-direction: column;
  gap: var(--spacing-md);
}

.admin-shell-toolbar {
  min-height: 2.75rem;
}

.admin-shell-breadcrumb {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.admin-shell-breadcrumb-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-decoration: none;
}

.admin-shell-breadcrumb-link:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.admin-shell-breadcrumb-tail {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  animation: breadcrumb-slide 220ms ease-out both;
}

.admin-shell-content {
  margin-top: var(--spacing-xl);
}

@keyframes breadcrumb-slide {
  from {
    opacity: 0;
    transform: translateX(-0.4rem);
  }
}

@media (min-width: 48rem) {
  .admin-shell-title-row,
  .admin-shell-toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.admin-forward-enter-active,
.admin-forward-leave-active,
.admin-backward-enter-active,
.admin-backward-leave-active {
  transition:
    opacity 240ms ease,
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.admin-forward-enter-from,
.admin-backward-leave-to {
  opacity: 0;
  transform: translateX(2rem);
}

.admin-forward-leave-to,
.admin-backward-enter-from {
  opacity: 0;
  transform: translateX(-2rem);
}

@media (prefers-reduced-motion: reduce) {
  .admin-forward-enter-active,
  .admin-forward-leave-active,
  .admin-backward-enter-active,
  .admin-backward-leave-active {
    transition: none;
  }

  .admin-shell-breadcrumb-tail {
    animation: none;
  }
}
</style>
