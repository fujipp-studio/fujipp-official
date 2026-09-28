<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface SectionIndicatorItem {
  id: string
  label: string
}

const props = defineProps<{
  sections: readonly SectionIndicatorItem[]
  ariaLabel?: string
  sectionActionLabel?: (label: string) => string
}>()
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
      :aria-label="sectionActionLabel?.(section.label) ?? `Go to ${section.label}`"
      :aria-current="activeSection === index ? 'step' : undefined"
      @click="goToSection(section.id)"
    >
      <span class="section-indicator__label" aria-hidden="true">{{ section.label }}</span>
      <span class="section-indicator__mark" aria-hidden="true" />
    </button>
  </nav>
</template>

<style scoped>
.section-indicator {
  position: fixed;
  z-index: var(--z-sticky);
  top: 4rem;
  right: var(--space-xs);
  bottom: 0;
  display: flex;
  width: 2.5rem;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-evenly;
  mix-blend-mode: difference;
}

.section-indicator button {
  position: relative;
  z-index: 1;
  display: flex;
  width: 1.5rem;
  height: 1.5rem;
  align-items: center;
  justify-content: flex-end;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.section-indicator__label {
  position: absolute;
  top: 50%;
  right: calc(100% + var(--space-xs));
  width: max-content;
  max-width: min(20rem, calc(100vw - 4rem));
  overflow: hidden;
  color: var(--semantic-color-text-text-blend-source);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-medium);
  line-height: var(--line-height-body);
  opacity: 0;
  pointer-events: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  transform: translate(var(--space-xs), -50%);
  transition:
    opacity 160ms ease,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.section-indicator__mark {
  width: 0.875rem;
  height: 2px;
  background: var(--semantic-color-text-text-blend-source);
  opacity: 0.55;
  transform: scaleX(0.5714);
  transform-origin: right center;
  transition:
    width 240ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 180ms ease,
    opacity 180ms ease;
}

.section-indicator button.active .section-indicator__mark {
  opacity: 1;
  transform: scaleX(1);
}

@media (hover: hover) {
  .section-indicator button:hover .section-indicator__label {
    opacity: 1;
    transform: translate(0, -50%);
  }

  .section-indicator button:not(.active):hover .section-indicator__mark {
    opacity: 0.85;
    transform: scaleX(0.7143);
  }
}

.section-indicator button:focus-visible {
  border-radius: var(--corner-radius-sm);
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 1px;
}

.section-indicator button:focus-visible .section-indicator__label {
  opacity: 1;
  transform: translate(0, -50%);
}

.section-indicator button:not(.active):focus-visible .section-indicator__mark {
  opacity: 0.85;
  transform: scaleX(0.7143);
}

@media (max-width: 47.99rem) {
  .section-indicator {
    top: 3rem;
    right: var(--space-xxs);
  }
}

@media (prefers-reduced-motion: reduce) {
  .section-indicator__label,
  .section-indicator__mark {
    transition: none;
  }
}
</style>
