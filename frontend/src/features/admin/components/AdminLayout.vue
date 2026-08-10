<script setup lang="ts">
import { inject } from 'vue'

const embedded = inject('admin-view-shell', false)
</script>

<template>
  <div v-if="embedded" class="admin-embedded-layout"><slot /></div>
  <main v-else class="min-h-screen bg-bg-default pt-24 text-text-primary desktop:pt-28">
    <div class="page-container space-y-3xl pb-5xl"><slot /></div>
  </main>
</template>

<style scoped>
.admin-embedded-layout {
  min-width: 0;
}
</style>
