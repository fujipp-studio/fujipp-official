<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

import darkFaviconUrl from './assets/brand/fujipp-tab-dark.svg?url'
import lightFaviconUrl from './assets/brand/fujipp-tab-light.svg?url'
import { AppNavbar } from './shared/layout'
import { useAuthStore, useThemeStore } from './stores'
import { useAdminToolsVisibility } from './features/admin/composables/useAdminToolsVisibility'

const AdminTools = defineAsyncComponent(
  () => import('./features/admin/components/AdminTools.vue'),
)

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()
const { currentUser, initialized, isAuthenticated } = storeToRefs(auth)
const { isDarkTheme } = storeToRefs(theme)
const themeFaviconUrls = new Map([
  ['dark', darkFaviconUrl],
  ['light', lightFaviconUrl],
])
const { visible: adminToolsVisible, initialize: initializeAdminToolsVisibility } = useAdminToolsVisibility()
const activeNavigationItem = computed(() => {
  if (route.path === '/about') return 'About'
  if (route.path.startsWith('/work')) return 'Work'
  if (route.path.startsWith('/store')) return 'Store'
  if (route.path.startsWith('/my-bot')) return 'My bot'
  return 'Home'
})

onMounted(initializeAdminToolsVisibility)

watch(
  isDarkTheme,
  (dark) => {
    const activeTheme = dark ? 'dark' : 'light'
    const href = themeFaviconUrls.get(activeTheme)
    if (!href) return
    const themedHref = new URL(href, window.location.href)
    themedHref.searchParams.set('theme', activeTheme)

    document.querySelectorAll<HTMLLinkElement>('[data-theme-favicon]').forEach((favicon) => {
      favicon.remove()
    })
    const favicon = document.createElement('link')
    favicon.rel = 'icon'
    favicon.type = 'image/svg+xml'
    favicon.setAttribute('sizes', 'any')
    favicon.href = themedHref.href
    favicon.dataset.themeFavicon = activeTheme
    document.head.append(favicon)
  },
  { immediate: true },
)

watch(
  [initialized, isAuthenticated, currentUser, () => route.fullPath],
  async ([ready, authenticated, user]) => {
    if (!ready) return
    if (
      import.meta.env.VITE_PERFORMANCE_AUDIT === 'true' &&
      route.path.startsWith('/store')
    ) {
      return
    }
    const requiresAuth = route.matched.some((record) => record.meta.requiresAuth)
    const roles = route.matched.flatMap((record) => record.meta.roles ?? [])
    const unauthorized = roles.length > 0 && (!user || !roles.includes(user.role))
    if ((requiresAuth && !authenticated) || unauthorized) {
      await router.replace({
        name: 'home',
        query: route.query.locale === 'th' ? { locale: 'th' } : {},
      })
    }
  },
  { immediate: true },
)
</script>

<template>
  <AppNavbar v-if="!route.meta.hideGlobalNavbar" :active-item="activeNavigationItem" />
  <RouterView />
  <AdminTools v-if="currentUser?.role === 'ADMIN' && adminToolsVisible && !route.meta.hideGlobalNavbar" />
</template>
