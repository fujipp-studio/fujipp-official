<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '../stores'

const authStore = useAuthStore()
const router = useRouter()
const message = ref('Completing sign in…')

onMounted(async () => {
  const result = await authStore.completeOAuthCallback()
  if (result.success) {
    await router.replace('/design-system')
    return
  }
  message.value = result.message ?? 'Unable to complete sign in.'
})
</script>

<template>
  <main class="auth-callback" aria-live="polite">
    <p>{{ message }}</p>
  </main>
</template>

<style scoped>
.auth-callback {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: var(--space-md);
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
  font-family: var(--font-family-sans);
}
</style>
