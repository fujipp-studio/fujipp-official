<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { AppNavbar } from './shared/layout'

const route = useRoute()
const activeNavigationItem = computed(() => {
  if (route.path === '/about') return 'About'
  if (route.path.startsWith('/work')) return 'Work'
  return 'Home'
})
</script>

<template>
  <AppNavbar
    v-if="!route.meta.hideGlobalNavbar"
    :active-item="activeNavigationItem"
  />
  <RouterView />
</template>
