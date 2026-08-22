<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

import { AppNavbar } from './shared/layout'
import { useAuthStore } from './stores'

const AdminTools = defineAsyncComponent(
  () => import('./features/admin/components/AdminTools.vue'),
)

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { currentUser, initialized, isAuthenticated } = storeToRefs(auth)
const activeNavigationItem = computed(() => {
  if (route.path === '/about') return 'About'
  if (route.path.startsWith('/work')) return 'Work'
  if (route.path.startsWith('/store')) return 'Store'
  if (route.path.startsWith('/my-bot')) return 'My bot'
  return 'Home'
})

watch(
  [initialized, isAuthenticated, currentUser, () => route.fullPath],
  async ([ready, authenticated, user]) => {
    if (!ready) return
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
  <AdminTools v-if="currentUser?.role === 'ADMIN' && !route.meta.hideGlobalNavbar" />
</template>
