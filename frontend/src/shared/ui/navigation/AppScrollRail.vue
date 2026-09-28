<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const scrollProgress = ref(0)
let animationFrame: number | undefined
let resizeObserver: ResizeObserver | undefined

function updateProgress() {
  animationFrame = undefined
  const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight
  const progress = scrollableDistance > 0 ? window.scrollY / scrollableDistance : 0
  scrollProgress.value = Math.min(1, Math.max(0, progress)) * 100
}

function requestUpdate() {
  if (animationFrame === undefined) animationFrame = window.requestAnimationFrame(updateProgress)
}

function goToScrollProgress(event: Event) {
  const control = event.currentTarget as HTMLInputElement
  const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight
  window.scrollTo({ top: scrollableDistance * (Number(control.value) / 100), behavior: 'auto' })
}

watch(
  () => route.fullPath,
  async () => {
    await nextTick()
    requestUpdate()
  },
)

onMounted(() => {
  updateProgress()
  window.addEventListener('scroll', requestUpdate, { passive: true })
  window.addEventListener('resize', requestUpdate)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(requestUpdate)
    resizeObserver.observe(document.documentElement)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', requestUpdate)
  window.removeEventListener('resize', requestUpdate)
  resizeObserver?.disconnect()
  if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <div
    class="app-scroll-rail"
    :class="{ 'app-scroll-rail--full-height': route.meta.hideGlobalNavbar }"
    :style="{ '--scroll-progress': `${scrollProgress}%` }"
  >
    <span class="app-scroll-rail__progress" aria-hidden="true" />
    <input
      class="app-scroll-rail__control"
      type="range"
      min="0"
      max="100"
      step="0.1"
      :value="scrollProgress"
      aria-label="Scroll position"
      @input="goToScrollProgress"
    />
  </div>
</template>

<style scoped>
.app-scroll-rail {
  position: fixed;
  z-index: var(--z-sticky);
  top: 4rem;
  right: var(--space-xs);
  bottom: 0;
  width: 1px;
  background: var(--semantic-color-border-border-default);
}

.app-scroll-rail--full-height {
  top: 0;
}

.app-scroll-rail__progress {
  position: absolute;
  top: 0;
  right: 0;
  width: 1px;
  height: var(--scroll-progress);
  background: var(--semantic-color-text-text-primary);
  pointer-events: none;
  transition: height 80ms linear;
}

.app-scroll-rail__control {
  position: absolute;
  top: 0;
  right: -0.4375rem;
  width: 1rem;
  height: 100%;
  margin: 0;
  cursor: pointer;
  opacity: 0;
  writing-mode: vertical-lr;
}

@media (max-width: 47.99rem) {
  .app-scroll-rail {
    top: 3rem;
    right: var(--space-xxs);
  }

  .app-scroll-rail--full-height {
    top: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-scroll-rail__progress {
    transition: none;
  }
}
</style>
