<script setup lang="ts">
import { ref } from 'vue'

import { getIconColorMode } from '../../../config'
import type { IconSource } from '../../../config'

type ButtonVariant = 'primary' | 'secondary'
type ButtonType = 'button' | 'submit' | 'reset'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    type?: ButtonType
    leftIcon?: IconSource
    rightIcon?: IconSource
    disabled?: boolean
    href?: string
    target?: '_blank' | '_self'
    rel?: string
  }>(),
  {
    variant: 'primary',
    type: 'button',
    leftIcon: undefined,
    rightIcon: undefined,
    disabled: false,
    href: undefined,
    target: undefined,
    rel: undefined,
  },
)

const buttonElement = ref<HTMLButtonElement | HTMLAnchorElement>()

function updatePointerTilt(event: PointerEvent) {
  if (props.disabled || !buttonElement.value) return

  const bounds = buttonElement.value.getBoundingClientRect()
  const pointerRatio = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1)
  const tilt = (pointerRatio - 0.5) * 8

  buttonElement.value.style.setProperty('--button-tilt', `${tilt}deg`)
}

function resetPointerTilt() {
  buttonElement.value?.style.removeProperty('--button-tilt')
}
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    ref="buttonElement"
    class="app-button"
    :class="`app-button--${variant}`"
    :type="href ? undefined : type"
    :disabled="href ? undefined : disabled"
    :href="disabled ? undefined : href"
    :target="href ? target : undefined"
    :rel="href ? rel : undefined"
    :aria-disabled="href && disabled ? 'true' : undefined"
    :tabindex="href && disabled ? -1 : undefined"
    @pointermove="updatePointerTilt"
    @pointerleave="resetPointerTilt"
  >
    <img
      v-if="leftIcon && getIconColorMode(leftIcon) === 'original'"
      class="app-button__icon"
      :src="leftIcon"
      alt=""
    />
    <span
      v-else-if="leftIcon"
      class="app-button__icon app-button__icon--mask"
      :style="{ '--button-icon': `url(${leftIcon})` }"
      aria-hidden="true"
    />

    <span class="app-button__label">
      <slot />
    </span>

    <img
      v-if="rightIcon && getIconColorMode(rightIcon) === 'original'"
      class="app-button__icon"
      :src="rightIcon"
      alt=""
    />
    <span
      v-else-if="rightIcon"
      class="app-button__icon app-button__icon--mask"
      :style="{ '--button-icon': `url(${rightIcon})` }"
      aria-hidden="true"
    />
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
  font-weight: var(--typography-font-weight-medium);
  white-space: nowrap;
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

.app-button__icon--mask {
  background-color: currentcolor;
  mask: var(--button-icon) center / contain no-repeat;
}

@media (prefers-reduced-motion: reduce) {
  .app-button {
    transition: none;
    transform: none;
  }
}
</style>
