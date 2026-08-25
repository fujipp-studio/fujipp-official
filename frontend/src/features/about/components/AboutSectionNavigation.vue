<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { aboutSections } from '../config'

const activeSection = ref(0)
const { t } = useI18n()
let animationFrame: number | undefined

function updateProgress() {
  animationFrame = undefined
  const sectionElements = aboutSections
    .map(({ id }) => document.getElementById(id))
    .filter((element): element is HTMLElement => element !== null)

  if (!sectionElements.length) return

  const navbarOffset = 64
  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY

  sectionElements.forEach((element, index) => {
    const distance = Math.abs(element.getBoundingClientRect().top - navbarOffset)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  })

  activeSection.value = closestIndex
}

function requestUpdate() {
  if (animationFrame === undefined) animationFrame = window.requestAnimationFrame(updateProgress)
}

function goToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
}

onMounted(() => {
  updateProgress()
  window.addEventListener('scroll', requestUpdate, { passive: true })
  window.addEventListener('resize', requestUpdate)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', requestUpdate)
  window.removeEventListener('resize', requestUpdate)
  if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <nav class="about-section-navigation" :aria-label="t('about.sections.navigationLabel')">
    <button
      v-for="(section, index) in aboutSections"
      :key="section.id"
      type="button"
      :aria-label="t('about.sections.goTo', { section: t(section.labelKey) })"
      :aria-current="index === activeSection ? 'step' : undefined"
      :class="{ 'about-section-navigation__button--active': index === activeSection }"
      @click="goToSection(section.id)"
    >
      <span aria-hidden="true" />
    </button>
  </nav>
</template>

<style scoped>
.about-section-navigation {
  position: fixed;
  z-index: var(--z-sticky);
  top: 50%;
  right: var(--space-xs);
  display: flex;
  width: var(--space-sm);
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-xs);
  transform: translateY(-50%);
}

.about-section-navigation button {
  display: flex;
  width: 1.5rem;
  height: 1.5rem;
  align-items: center;
  justify-content: flex-end;
  cursor: pointer;
  border: 0;
  padding: 0;
  background: transparent;
}

.about-section-navigation span {
  width: 0.875rem;
  height: 2px;
  background: var(--semantic-color-text-text-muted);
  opacity: 0.55;
  transform: scaleX(0.5714);
  transform-origin: right center;
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.about-section-navigation__button--active span {
  background: var(--semantic-color-text-text-primary);
  opacity: 1;
  transform: scaleX(1);
}

.about-section-navigation button:not(.about-section-navigation__button--active):hover span,
.about-section-navigation button:not(.about-section-navigation__button--active):focus-visible span {
  opacity: 0.85;
  transform: scaleX(0.7143);
}

.about-section-navigation button:focus-visible {
  border-radius: var(--corner-radius-sm);
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 1px;
}

@media (max-width: 47.99rem) {
  .about-section-navigation {
    right: var(--space-xxs);
  }
}

@media (prefers-reduced-motion: reduce) {
  .about-section-navigation span {
    transition: none;
  }
}
</style>
