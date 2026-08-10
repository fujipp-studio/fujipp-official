<script setup lang="ts">
import AuthMark from './AuthMark.vue'

withDefaults(defineProps<{ open: boolean; message?: string }>(), {
  message: 'Authenticating…',
})
</script>

<template>
  <Teleport to="body">
    <Transition name="auth-loading-overlay">
      <div
        v-if="open"
        class="auth-loading-overlay"
        role="status"
        aria-live="polite"
        :aria-label="message"
      >
        <AuthMark class="auth-loading-overlay__mark" />
        <span class="auth-loading-overlay__message">{{ message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.auth-loading-overlay {
  position: fixed;
  z-index: var(--z-toast);
  inset: 0;
  display: grid;
  cursor: wait;
  place-items: center;
  background: var(--semantic-color-background-bg-overlay);
  color: var(--semantic-color-text-text-primary);
  backdrop-filter: blur(var(--effect-backdrop-blur-sm));
}

.auth-loading-overlay__mark {
  width: var(--icon-size-128);
  height: var(--icon-size-128);
  animation: auth-loading-mark-spin 1.15s linear infinite;
}

.auth-loading-overlay__message {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  margin: -1px;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.auth-loading-overlay-enter-active,
.auth-loading-overlay-leave-active {
  transition:
    opacity 180ms ease,
    backdrop-filter 180ms ease;
}

.auth-loading-overlay-enter-from,
.auth-loading-overlay-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);
}

@keyframes auth-loading-mark-spin {
  to {
    transform: rotate(1turn);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-loading-overlay__mark {
    animation: none;
  }
  .auth-loading-overlay-enter-active,
  .auth-loading-overlay-leave-active {
    transition: none;
  }
}
</style>
