<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { AppProgressiveImage } from '@/shared/ui'
import { useAnimationVisibility } from '@/shared/ui/useAnimationVisibility'
import { profilePhotos } from '../config/profile-photos'

const { t } = useI18n()
const gallery = ref<HTMLElement>()
const stage = ref<HTMLElement>()
const active = ref(0)
const loaded = ref(
  new Set(
    Array.from(
      { length: 7 },
      (_, index) => (index - 3 + profilePhotos.length) % profilePhotos.length,
    ),
  ),
)
const paused = ref(false)
const hovered = ref(false)
const focused = ref(false)
const dragging = ref(false)
const motionVisible = ref(false)
const autoRunning = computed(
  () => motionVisible.value && !paused.value && !hovered.value && !focused.value && !dragging.value,
)
let timer: ReturnType<typeof setInterval> | undefined
let pointerStart: { id: number; x: number; y: number; cardIndex: number | null } | undefined

useAnimationVisibility(gallery, (visible) => {
  motionVisible.value = visible
})

function stop() {
  if (timer !== undefined) clearInterval(timer)
  timer = undefined
}

function relativePosition(index: number) {
  let offset = (index - active.value + profilePhotos.length) % profilePhotos.length
  if (offset > profilePhotos.length / 2) offset -= profilePhotos.length
  return offset
}

function cardStyle(index: number) {
  const offset = relativePosition(index)
  const depth = Math.min(Math.abs(offset), 4)
  const shift = [0, 23, 34, 43, 46][depth]!
  return {
    '--card-shift': `${Math.sign(offset) * shift}%`,
    '--card-scale': [1, 0.88, 0.76, 0.64, 0.56][depth],
    '--card-photo-opacity': [1, 0.72, 0.52, 0.36, 0.2][depth],
    '--card-opacity': Math.abs(offset) <= 3 ? 1 : 0,
    '--card-layer': 10 - depth,
  }
}

function show(index: number) {
  const next = (index + profilePhotos.length) % profilePhotos.length
  const ready = new Set(loaded.value)
  for (let offset = -3; offset <= 3; offset++)
    ready.add((next + offset + profilePhotos.length) % profilePhotos.length)
  loaded.value = ready
  active.value = next
}

function startSwipe(event: PointerEvent) {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
  const card =
    event.target instanceof Element ? event.target.closest<HTMLElement>('[data-photo-index]') : null
  pointerStart = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    cardIndex: card ? Number(card.dataset.photoIndex) : null,
  }
  dragging.value = true
  stage.value?.setPointerCapture(event.pointerId)
}

function finishSwipe(event: PointerEvent) {
  const start = pointerStart
  if (!start || start.id !== event.pointerId) return
  pointerStart = undefined
  dragging.value = false
  if (stage.value?.hasPointerCapture(event.pointerId))
    stage.value.releasePointerCapture(event.pointerId)
  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    stage.value?.focus({ preventScroll: true })
    show(active.value + (dx < 0 ? 1 : -1))
  } else if (Math.hypot(dx, dy) <= 10 && start.cardIndex !== null) {
    stage.value?.focus({ preventScroll: true })
    show(start.cardIndex)
  }
}

function cancelSwipe(event: PointerEvent) {
  if (pointerStart?.id !== event.pointerId) return
  pointerStart = undefined
  dragging.value = false
  if (stage.value?.hasPointerCapture(event.pointerId))
    stage.value.releasePointerCapture(event.pointerId)
}

function selectCard(index: number, event: MouseEvent) {
  // Pointer gestures are handled on release, avoiding a second selection after a drag.
  if (event.detail !== 0) return
  stage.value?.focus({ preventScroll: true })
  show(index)
}

function step(direction: number) {
  stage.value?.focus({ preventScroll: true })
  show(active.value + direction)
}

function focusOut(event: FocusEvent) {
  focused.value =
    event.relatedTarget instanceof Node && Boolean(gallery.value?.contains(event.relatedTarget))
}

function toggleAutoplay() {
  if (autoRunning.value) {
    paused.value = true
  } else {
    paused.value = false
    hovered.value = false
    focused.value = false
  }
}

watch(autoRunning, (running) => {
  stop()
  if (running) timer = setInterval(() => show(active.value + 1), 5000)
})

onBeforeUnmount(() => {
  stop()
  pointerStart = undefined
})
</script>

<template>
  <section
    ref="gallery"
    class="portrait-gallery"
    :aria-label="t('about.gallery.label')"
    :aria-roledescription="t('about.gallery.carousel')"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focused = true"
    @focusout="focusOut"
    @keydown.left.prevent="step(-1)"
    @keydown.right.prevent="step(1)"
  >
    <div
      ref="stage"
      class="portrait-gallery__stage"
      tabindex="0"
      :aria-label="t('about.gallery.browse')"
      aria-keyshortcuts="ArrowLeft ArrowRight Space"
      @keydown.space.self.prevent="toggleAutoplay"
      @pointerdown="startSwipe"
      @pointerup="finishSwipe"
      @pointercancel="cancelSwipe"
    >
      <button
        v-for="(photo, index) in profilePhotos"
        :key="photo.id"
        type="button"
        class="portrait-gallery__card"
        :class="{ 'portrait-gallery__card--active': index === active }"
        :style="cardStyle(index)"
        :data-photo-index="index"
        :disabled="Math.abs(relativePosition(index)) > 3"
        :tabindex="index === active ? 0 : -1"
        :aria-current="index === active ? 'true' : undefined"
        :aria-label="`${t('about.gallery.position', { number: index + 1, total: profilePhotos.length })}: ${t(photo.altKey)}`"
        :aria-hidden="Math.abs(relativePosition(index)) > 3"
        @click="selectCard(index, $event)"
      >
        <AppProgressiveImage
          v-if="loaded.has(index)"
          class="portrait-gallery__photo"
          :src="photo.src"
          :placeholder-src="photo.placeholderSrc"
          :alt="t(photo.altKey)"
          :width="photo.width"
          :height="photo.height"
          :fit="photo.fit"
          :loading="index === 0 ? 'eager' : 'lazy'"
          :fetchpriority="index === 0 ? 'high' : 'auto'"
        />
      </button>
    </div>
    <span class="sr-only" :aria-live="autoRunning ? 'off' : 'polite'">
      {{ t('about.gallery.position', { number: active + 1, total: profilePhotos.length }) }}
    </span>
  </section>
</template>

<style scoped>
.portrait-gallery {
  min-width: 0;
  width: 100%;
}

.portrait-gallery__stage {
  position: relative;
  isolation: isolate;
  width: 100%;
  aspect-ratio: 11 / 10;
  touch-action: pan-y pinch-zoom;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}

.portrait-gallery__stage:active {
  cursor: grabbing;
}

.portrait-gallery__card {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: var(--card-layer);
  width: 66%;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  padding: var(--space-xxs);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  background: var(--semantic-color-background-bg-default);
  box-shadow: var(--effect-shadow-md);
  opacity: var(--card-opacity);
  pointer-events: none;
  appearance: none;
  font: inherit;
  cursor: pointer;
  transform: translate(-50%, -50%) translateX(var(--card-shift)) scale(var(--card-scale));
  transition:
    transform 620ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 420ms ease;
}

.portrait-gallery__card:not(:disabled) {
  pointer-events: auto;
}

.portrait-gallery__card:not(:disabled):hover {
  border-color: var(--semantic-color-border-border-strong);
}

.portrait-gallery__card--active {
  box-shadow: var(--effect-shadow-lg);
}

.portrait-gallery__photo {
  width: 100%;
  height: 100%;
  border-radius: var(--corner-radius-md);
  opacity: var(--card-photo-opacity);
  transition: opacity 420ms ease;
}

.portrait-gallery__photo :deep(img) {
  -webkit-user-drag: none;
}

.portrait-gallery__stage:focus-visible,
.portrait-gallery__card:focus-visible {
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: var(--space-xxs);
}

@media (prefers-reduced-motion: reduce) {
  .portrait-gallery__card,
  .portrait-gallery__photo {
    transition: none;
  }
}
</style>
