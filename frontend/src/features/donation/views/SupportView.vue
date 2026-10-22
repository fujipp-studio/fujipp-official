<script setup lang="ts">
import { DonationSupportSection } from '../components'
</script>

<template>
  <div class="support-page">
    <main class="support-page__main">
      <DonationSupportSection standalone />
    </main>
  </div>
</template>

<style scoped>
.support-page {
  width: 100%;
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
}
.support-page__main {
  min-height: 100dvh;
}
</style>
