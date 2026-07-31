<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const sections = [
  { id: 'home-hero', labelKey: 'home.sections.introduction' },
  { id: 'problem-solution', labelKey: 'home.sections.botSetup' },
  { id: 'services-features', labelKey: 'home.sections.services' },
  { id: 'trusted-by', labelKey: 'home.sections.communities' },
  { id: 'about-us', labelKey: 'home.sections.developer' },
] as const

const activeSection = ref(0)
const { t } = useI18n()
let animationFrame: number | undefined

function updateProgress() {
  animationFrame = undefined
  const sectionElements = sections
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
  <nav
    class="scroll-progress"
    :aria-label="t('home.sections.navigationLabel')"
  >
    <button
      v-for="(section, index) in sections"
      :key="section.id"
      type="button"
      class="scroll-progress__button"
      :class="{ 'scroll-progress__button--active': index === activeSection }"
      :aria-label="t('home.sections.goTo', { section: t(section.labelKey) })"
      :aria-current="index === activeSection ? 'step' : undefined"
      @click="goToSection(section.id)"
    >
      <span class="scroll-progress__tick" aria-hidden="true" />
    </button>
  </nav>
</template>

<style scoped>
.scroll-progress {
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

.scroll-progress__button {
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

.scroll-progress__tick {
  width: 0.5rem;
  height: 2px;
  background: var(--semantic-color-text-text-muted);
  opacity: 0.55;
  transition:
    width 180ms ease,
    opacity 180ms ease,
    background-color 180ms ease;
}

.scroll-progress__button:hover .scroll-progress__tick,
.scroll-progress__button:focus-visible .scroll-progress__tick,
.scroll-progress__button--active .scroll-progress__tick {
  width: 0.875rem;
  background: var(--semantic-color-text-text-primary);
  opacity: 1;
}

@media (max-width: 47.99rem) {
  .scroll-progress {
    right: var(--space-xxs);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scroll-progress__tick {
    transition: none;
  }
}
</style>
