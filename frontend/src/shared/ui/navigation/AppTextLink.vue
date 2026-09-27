<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { RouterLink } from 'vue-router'

defineProps<{
  to: RouteLocationRaw
}>()
</script>

<template>
  <RouterLink class="app-text-link" :to="to">
    <span><slot /></span>
    <svg class="app-text-link__icon" viewBox="0 0 33 26" fill="none" aria-hidden="true">
      <path d="M18 24.8437L31 12.8438L18 0.843749" />
      <path d="M30.5 13H0" />
    </svg>
  </RouterLink>
</template>

<style scoped>
.app-text-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding-block: var(--space-xs);
  color: var(--semantic-color-text-text-primary);
  font-size: var(--font-size-heading-h4);
  font-weight: var(--typography-font-weight-regular);
  line-height: var(--line-height-heading);
  text-decoration: none;
}

.app-text-link::before,
.app-text-link::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 1px;
  content: '';
}

.app-text-link::before {
  background: var(--semantic-color-border-border-default);
}

.app-text-link::after {
  background: currentcolor;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.app-text-link:hover::after,
.app-text-link:focus-visible::after {
  transform: scaleX(1);
  transform-origin: left;
}

.app-text-link__icon {
  width: var(--icon-size-24);
  flex: 0 0 auto;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.app-text-link:focus-visible {
  border-radius: var(--corner-radius-sm);
  outline: 3px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .app-text-link::after {
    transition: none;
  }
}
</style>
