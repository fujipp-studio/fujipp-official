<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import type { IconSource } from '../../../config'
import AppIcon from '../icons/AppIcon.vue'

type ButtonVariant = 'primary' | 'secondary'
type ButtonType = 'button' | 'submit' | 'reset'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    type?: ButtonType
    leftIcon?: IconSource
    rightIcon?: IconSource
    disabled?: boolean
    loading?: boolean
    href?: string
    to?: RouteLocationRaw
    target?: '_blank' | '_self'
    rel?: string
  }>(),
  {
    variant: 'primary',
    type: 'button',
    leftIcon: undefined,
    rightIcon: undefined,
    disabled: false,
    loading: false,
    href: undefined,
    to: undefined,
    target: undefined,
    rel: undefined,
  },
)

const buttonElement = ref<HTMLElement | { $el: HTMLElement }>()
const isLink = computed(() => Boolean(props.to || props.href))
const elementAttributes = computed(() => props.to ? {
  to: props.to,
  ...(props.disabled || props.loading ? { href: undefined } : {}),
} : {
  type: props.href ? undefined : props.type,
  href: props.disabled || props.loading ? undefined : props.href,
  disabled: props.href ? undefined : props.disabled || props.loading,
})

function element() {
  const value = buttonElement.value
  return value instanceof HTMLElement ? value : value?.$el
}

function guardDisabledLink(event: MouseEvent) {
  if (isLink.value && (props.disabled || props.loading)) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}

function updatePointerTilt(event: PointerEvent) {
  const target = element()
  if (props.disabled || props.loading || !target) return

  const bounds = target.getBoundingClientRect()
  const pointerRatio = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1)
  const tilt = (pointerRatio - 0.5) * 8

  target.style.setProperty('--button-tilt', `${tilt}deg`)
}

function resetPointerTilt() {
  element()?.style.removeProperty('--button-tilt')
}
</script>

<template>
  <component
    :is="to ? RouterLink : href ? 'a' : 'button'"
    ref="buttonElement"
    class="app-button"
    :class="`app-button--${variant}`"
    v-bind="elementAttributes"
    :target="isLink ? target : undefined"
    :rel="isLink ? rel : undefined"
    :aria-disabled="isLink && (disabled || loading) ? 'true' : undefined"
    :aria-busy="loading || undefined"
    :tabindex="isLink && (disabled || loading) ? -1 : undefined"
    @click.capture="guardDisabledLink"
    @pointermove="updatePointerTilt"
    @pointerleave="resetPointerTilt"
  >
    <AppIcon v-if="leftIcon" class="app-button__icon" :source="leftIcon" />

    <span v-if="loading" class="app-button__spinner" aria-hidden="true" />
    <span class="app-button__label" :class="{ 'app-button__label--loading': loading }">
      <slot />
    </span>

    <AppIcon v-if="rightIcon" class="app-button__icon" :source="rightIcon" />
  </component>
</template>

<style scoped>
.app-button {
  --button-tilt: 0deg;

  position: relative;
  isolation: isolate;
  display: inline-flex;
  width: 100%;
  height: 2.5rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: var(--space-xxs);
  overflow: hidden;
  padding: var(--space-xs) var(--space-md);
  border: 0;
  border-radius: 0.75rem;
  box-shadow: var(--effect-shadow-button);
  cursor: pointer;
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-large);
  line-height: var(--line-height-label);
  text-align: center;
  text-decoration: none;
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease,
    transform 100ms ease-out;
  transform-style: preserve-3d;
  will-change: transform;
}

.app-button--primary {
  border: 1px solid color-mix(in srgb, var(--semantic-color-border-border-default) 60%, transparent);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 80%, transparent),
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 60%, transparent)
    ),
    transparent;
  box-shadow: var(--effect-glass-highlight), var(--effect-shadow-button);
  color: var(--semantic-color-text-text-primary);
  backdrop-filter: blur(0) saturate(1.5);
}

.app-button--secondary {
  background: var(--semantic-color-action-backgrounds-bg-secondary);
  color: var(--semantic-color-action-text-text-on-secondary);
}

.app-button:not(:disabled):hover {
  transform: perspective(24rem) rotateY(var(--button-tilt)) translateY(1px) scale(0.99);
}

.app-button--primary:not(:disabled):hover {
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 95%, transparent),
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 70%, transparent)
    ),
    transparent;
}

.app-button--secondary:not(:disabled):hover {
  background: var(--semantic-color-action-backgrounds-bg-secondary-hover);
}

.app-button:not(:disabled):active {
  box-shadow: var(--effect-shadow-sm);
  transform: perspective(24rem) rotateY(var(--button-tilt)) translateY(2px) scale(0.97);
}

.app-button:disabled {
  cursor: not-allowed;
  border: 1px solid var(--semantic-color-border-border-disabled);
  background: var(--semantic-color-action-backgrounds-bg-disabled);
  box-shadow: none;
  color: var(--semantic-color-action-text-text-disabled);
}

.app-button__label {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  font-weight: var(--typography-font-weight-medium);
  white-space: nowrap;
}
.app-button__label--loading {
  opacity: 0.65;
}
.app-button__spinner {
  position: relative;
  z-index: 1;
  width: var(--icon-size-16);
  height: var(--icon-size-16);
  flex: none;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: var(--radius-full);
  animation: app-button-spin 650ms linear infinite;
}
@keyframes app-button-spin {
  to {
    transform: rotate(360deg);
  }
}

.app-button__icon {
  position: relative;
  z-index: 1;
  display: block;
  width: var(--icon-size-24);
  height: var(--icon-size-24);
  flex-shrink: 0;
  object-fit: contain;
}

@media (prefers-reduced-motion: reduce) {
  .app-button {
    transition: none;
    transform: none;
  }
  .app-button__spinner {
    animation: none;
  }
}
</style>
