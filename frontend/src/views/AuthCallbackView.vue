<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AuthMark from '../shared/ui/dialogs/AuthMark.vue'
import { useAuthStore } from '../stores'
import DesignSystemView from './DesignSystemView.vue'

const authStore = useAuthStore()
const router = useRouter()
const message = ref('Completing sign in…')
const failed = ref(false)

onMounted(async () => {
  const callbackError = getCallbackError()
  if (callbackError) {
    failed.value = true
    message.value = callbackError
    return
  }

  const result = await authStore.completeOAuthCallback()
  if (result.success) {
    await router.replace('/design-system')
    return
  }
  failed.value = true
  message.value = result.message ?? 'Unable to complete sign in.'
})

function getCallbackError() {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const code = url.searchParams.get('error_code') ?? hash.get('error_code')
  const description =
    url.searchParams.get('error_description') ?? hash.get('error_description')

  if (code === 'otp_expired') {
    return 'This confirmation link is invalid or has expired. Use the newest confirmation email or sign up again.'
  }

  return description
}
</script>

<template>
  <main class="auth-callback-page">
    <DesignSystemView />

    <section
      v-if="!failed"
      class="auth-callback auth-callback__status"
      role="status"
      aria-live="polite"
      aria-label="Completing sign in"
    >
      <span class="auth-callback__loader" aria-hidden="true">
        <AuthMark class="auth-callback__mark" />
      </span>
      <p class="auth-callback__sr-only">{{ message }}</p>
    </section>

    <section v-else class="auth-callback auth-callback__failed">
      <div class="auth-callback__error" role="alert">
        <AuthMark class="auth-callback__error-mark" />
        <p>{{ message }}</p>
        <button type="button" @click="router.replace('/design-system')">
          Return to sign in
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-callback-page {
  min-height: 100dvh;
}

.auth-callback {
  position: fixed;
  z-index: var(--z-modal);
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--space-md);
  background: var(--semantic-color-background-bg-overlay);
  backdrop-filter: blur(var(--effect-backdrop-blur-sm));
  color: var(--semantic-color-text-text-primary);
  font-family: var(--font-family-sans);
}

.auth-callback__status {
  cursor: wait;
}

.auth-callback__failed {
  cursor: default;
}

.auth-callback__loader {
  display: block;
}

.auth-callback__mark {
  display: block;
  width: var(--icon-size-128);
  height: var(--icon-size-128);
  color: var(--semantic-color-text-text-primary);
  animation: auth-mark-spin 1.15s linear infinite;
}

.auth-callback__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  margin: -1px;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.auth-callback__error {
  display: grid;
  width: min(28rem, calc(100vw - 2rem));
  place-items: center;
  gap: var(--space-md);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  background: var(--semantic-color-background-bg-glass);
  box-shadow: var(--effect-shadow-xl), var(--effect-glass-highlight);
  text-align: center;
  backdrop-filter: blur(var(--effect-backdrop-blur-md));
}

.auth-callback__error-mark {
  width: var(--icon-size-64);
  height: var(--icon-size-64);
  color: var(--semantic-color-text-text-primary);
}

.auth-callback__error p {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-medium);
  line-height: var(--line-height-body);
}

.auth-callback__error button {
  border: 0;
  border-radius: var(--radius-md);
  padding: var(--space-xs) var(--space-md);
  background: var(--semantic-color-background-bg-inverse);
  color: var(--semantic-color-text-text-inverse);
  cursor: pointer;
  font: inherit;
  font-weight: var(--typography-font-weight-semibold);
}

@keyframes auth-mark-spin {
  to {
    transform: rotate(1turn);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-callback__mark {
    animation: none;
  }
}
</style>
