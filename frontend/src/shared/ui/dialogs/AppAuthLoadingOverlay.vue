<script setup lang="ts">
import { icons } from '../../../config'

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
        <svg
          class="auth-loading-overlay__mascot"
          viewBox="0 0 1080 1080"
          aria-hidden="true"
        >
          <use
            class="auth-loading-overlay__mascot-body"
            :href="`${icons.brand.mascot}#mascot-body`"
          />
          <use
            v-for="faceIndex in 12"
            :key="faceIndex"
            class="auth-loading-overlay__mascot-face"
            :href="`${icons.brand.mascot}#mascot-face-${faceIndex}`"
            :style="{ animationDelay: `${-(6 - (faceIndex - 1) * 0.5)}s` }"
          />
        </svg>
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

.auth-loading-overlay__mascot {
  width: var(--icon-size-128);
  height: var(--icon-size-128);
  transform-origin: center;
  animation: auth-loading-mascot-pulse 900ms ease-in-out infinite alternate;
}

.auth-loading-overlay__mascot-body {
  fill: var(--semantic-color-text-text-primary);
}

.auth-loading-overlay__mascot-face {
  fill: var(--semantic-color-text-text-inverse);
  opacity: 0;
  transform: scale(1.45);
  transform-box: view-box;
  transform-origin: 50% 64%;
  animation: auth-loading-mascot-face 6s steps(1, end) infinite;
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

@keyframes auth-loading-mascot-pulse {
  from {
    opacity: 0.72;
    transform: scale(0.96);
  }

  to {
    opacity: 1;
    transform: scale(1.04);
  }
}

@keyframes auth-loading-mascot-face {
  0%,
  8.32% {
    opacity: 1;
  }

  8.33%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-loading-overlay__mascot,
  .auth-loading-overlay__mascot-face {
    animation: none;
  }

  .auth-loading-overlay__mascot-face:nth-of-type(2) {
    opacity: 1;
  }

  .auth-loading-overlay-enter-active,
  .auth-loading-overlay-leave-active {
    transition: none;
  }
}
</style>
