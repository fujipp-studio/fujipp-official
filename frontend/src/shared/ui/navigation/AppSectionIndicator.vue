<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface SectionIndicatorItem {
  id: string
  label: string
}

const props = defineProps<{ sections: readonly SectionIndicatorItem[]; ariaLabel?: string }>()
const activeSection = ref(0)
let animationFrame: number | undefined

function updateActiveSection() {
  animationFrame = undefined
  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY

  props.sections.forEach((section, index) => {
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
  document.getElementById(id)?.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
}

watch(() => props.sections, requestUpdate, { deep: true })
onMounted(() => {
  document.documentElement.classList.add('section-scroll')
  updateActiveSection()
  addEventListener('scroll', requestUpdate, { passive: true })
  addEventListener('resize', requestUpdate)
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('section-scroll')
  removeEventListener('scroll', requestUpdate)
  removeEventListener('resize', requestUpdate)
  if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <nav class="section-indicator" :aria-label="ariaLabel ?? 'Page sections'">
    <button
      v-for="(section, index) in sections"
      :key="section.id"
      type="button"
      :class="{ active: activeSection === index }"
      :aria-label="`Go to ${section.label}`"
      :aria-current="activeSection === index ? 'step' : undefined"
      @click="goToSection(section.id)"
    >
      <span aria-hidden="true" />
    </button>
  </nav>
</template>

<style scoped>
.section-indicator { position: fixed; z-index: var(--z-sticky); top: 50%; right: var(--space-xs); display: flex; width: var(--space-sm); flex-direction: column; align-items: flex-end; gap: var(--space-xs); transform: translateY(-50%); }
.section-indicator button { display: flex; width: 1.5rem; height: 1.5rem; align-items: center; justify-content: flex-end; border: 0; padding: 0; background: transparent; cursor: pointer; }
.section-indicator span { width: 0.875rem; height: 2px; background: var(--semantic-color-text-text-muted); opacity: 0.55; transform: scaleX(0.5714); transform-origin: right center; transition: transform 180ms ease, opacity 180ms ease; }
.section-indicator button.active span { background: var(--semantic-color-text-text-primary); opacity: 1; transform: scaleX(1); }
.section-indicator button:not(.active):hover span, .section-indicator button:not(.active):focus-visible span { opacity: 0.85; transform: scaleX(0.7143); }
.section-indicator button:focus-visible { border-radius: var(--corner-radius-sm); outline: 2px solid var(--semantic-color-action-borders-border-focus); outline-offset: 1px; }
@media (max-width: 47.99rem) { .section-indicator { right: var(--space-xxs); } }
@media (prefers-reduced-motion: reduce) { .section-indicator span { transition: none; } }
</style>
