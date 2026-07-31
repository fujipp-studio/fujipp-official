<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { aboutSections } from '../config'

const activeSection = ref(0)
const { t } = useI18n()
let animationFrame: number | undefined
let scrollAnimationFrame: number | undefined
let previousScrollBehavior = ''

function restoreScrollBehavior() {
  document.documentElement.style.scrollBehavior = previousScrollBehavior
}

function cancelScrollAnimation() {
  if (scrollAnimationFrame === undefined) return
  cancelAnimationFrame(scrollAnimationFrame)
  scrollAnimationFrame = undefined
  restoreScrollBehavior()
}

function smoothScrollTo(targetY: number) {
  cancelScrollAnimation()

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const startY = window.scrollY
  const distance = targetY - startY
  if (reducedMotion || Math.abs(distance) < 2) {
    window.scrollTo({ top: targetY })
    return
  }

  const duration = Math.min(1300, Math.max(850, Math.abs(distance) * 0.8))
  const startTime = performance.now()
  previousScrollBehavior = document.documentElement.style.scrollBehavior
  document.documentElement.style.scrollBehavior = 'auto'

  function animateScroll(currentTime: number) {
    const elapsed = Math.min(1, (currentTime - startTime) / duration)
    const eased =
      elapsed < 0.5
        ? 4 * elapsed * elapsed * elapsed
        : 1 - Math.pow(-2 * elapsed + 2, 3) / 2

    window.scrollTo({ top: startY + distance * eased })

    if (elapsed < 1) {
      scrollAnimationFrame = requestAnimationFrame(animateScroll)
      return
    }

    scrollAnimationFrame = undefined
    restoreScrollBehavior()
  }

  scrollAnimationFrame = requestAnimationFrame(animateScroll)
}

function updateActiveSection() {
  animationFrame = undefined
  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY

  aboutSections.forEach((section, index) => {
    const element = document.getElementById(section.id)
    if (!element) return
    const distance = Math.abs(element.getBoundingClientRect().top - 64)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  })

  activeSection.value = closestIndex
}

function requestUpdate() {
  if (animationFrame === undefined) animationFrame = requestAnimationFrame(updateActiveSection)
}

function goToSection(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  smoothScrollTo(target.getBoundingClientRect().top + window.scrollY - 64)
}

onMounted(() => {
  updateActiveSection()
  addEventListener('scroll', requestUpdate, { passive: true })
  addEventListener('resize', requestUpdate)
  addEventListener('wheel', cancelScrollAnimation, { passive: true })
  addEventListener('touchstart', cancelScrollAnimation, { passive: true })
})

onBeforeUnmount(() => {
  removeEventListener('scroll', requestUpdate)
  removeEventListener('resize', requestUpdate)
  removeEventListener('wheel', cancelScrollAnimation)
  removeEventListener('touchstart', cancelScrollAnimation)
  if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
  cancelScrollAnimation()
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
  width: 0.5rem;
  height: 2px;
  background: var(--semantic-color-text-text-muted);
  opacity: 0.55;
  transition:
    width 180ms ease,
    opacity 180ms ease;
}

.about-section-navigation button:hover span,
.about-section-navigation button:focus-visible span,
.about-section-navigation__button--active span {
  width: 0.875rem;
  background: var(--semantic-color-text-text-primary);
  opacity: 1;
}
</style>
