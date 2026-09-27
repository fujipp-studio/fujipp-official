<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { trustedCommunities } from '../config'
import { AppProgressiveImage } from '../../../shared/ui'
const { t } = useI18n()

const trackElement = ref<HTMLElement>()

const baseSpeed = 100
let animationFrameId: number | undefined
let previousFrameTime = 0
let offset = 0
let speed = -baseSpeed
let targetSpeed = -baseSpeed
let lastPointerX = 0
let lastPointerTime = 0
let isDragging = false
let reducedMotionQuery: MediaQueryList | undefined

function getPanelWidth() {
  return (trackElement.value?.firstElementChild as HTMLElement | undefined)?.offsetWidth ?? 0
}

function renderMarquee(frameTime: number) {
  const track = trackElement.value
  const panelWidth = getPanelWidth()
  if (!track || !panelWidth) {
    animationFrameId = requestAnimationFrame(renderMarquee)
    return
  }

  if (previousFrameTime) {
    const elapsedSeconds = Math.min((frameTime - previousFrameTime) / 1000, 0.05)
    const easing = 1 - Math.exp(-elapsedSeconds * 3)
    speed += (targetSpeed - speed) * easing
    offset += speed * elapsedSeconds

    while (offset <= -panelWidth) offset += panelWidth
    while (offset > 0) offset -= panelWidth
    track.style.transform = `translate3d(${offset}px, 0, 0)`
  }

  previousFrameTime = frameTime
  animationFrameId = requestAnimationFrame(renderMarquee)
}

function startMarquee() {
  if (animationFrameId !== undefined || reducedMotionQuery?.matches) return
  trackElement.value?.classList.add('trusted-by-section__track--enhanced')
  previousFrameTime = 0
  animationFrameId = requestAnimationFrame(renderMarquee)
}

function stopMarquee() {
  if (animationFrameId !== undefined) cancelAnimationFrame(animationFrameId)
  animationFrameId = undefined
  previousFrameTime = 0
}

function handlePointerDown(event: PointerEvent) {
  if (reducedMotionQuery?.matches || event.button !== 0) return

  isDragging = true
  lastPointerX = event.clientX
  lastPointerTime = performance.now()
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (!isDragging || reducedMotionQuery?.matches) return
  if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
    resetDragState()
    return
  }

  const currentTime = performance.now()
  const elapsedMilliseconds = currentTime - lastPointerTime
  if (lastPointerTime && elapsedMilliseconds > 0 && elapsedMilliseconds < 160) {
    const pointerVelocity = ((event.clientX - lastPointerX) / elapsedMilliseconds) * 1000
    if (Math.abs(pointerVelocity) > 10) {
      speed = Math.max(-3000, Math.min(3000, pointerVelocity))
      targetSpeed = pointerVelocity < 0 ? -baseSpeed : baseSpeed
    }
  }

  lastPointerX = event.clientX
  lastPointerTime = currentTime
}

function handlePointerEnd(event: PointerEvent) {
  if (!isDragging) return

  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  resetDragState()
}

function resetDragState() {
  isDragging = false
  lastPointerTime = 0
}

function handleMotionPreferenceChange() {
  const track = trackElement.value
  if (!track) return

  if (reducedMotionQuery?.matches) {
    stopMarquee()
    track.classList.remove('trusted-by-section__track--enhanced')
    track.style.removeProperty('transform')
    return
  }

  startMarquee()
}

onMounted(() => {
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotionQuery.addEventListener('change', handleMotionPreferenceChange)
  handleMotionPreferenceChange()
})

onBeforeUnmount(() => {
  stopMarquee()
  reducedMotionQuery?.removeEventListener('change', handleMotionPreferenceChange)
})
</script>

<template>
  <section id="trusted-by" class="trusted-by-section" aria-labelledby="trusted-by-title">
    <div class="trusted-by-section__container">
      <div class="trusted-by-section__copy">
        <h2 id="trusted-by-title">{{ t('home.trusted.title') }}</h2>
        <p>{{ t('home.trusted.description') }}</p>
      </div>

      <div
        class="trusted-by-section__viewport"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerEnd"
        @pointercancel="handlePointerEnd"
        @lostpointercapture="resetDragState"
      >
        <div ref="trackElement" class="trusted-by-section__track">
          <ul
            v-for="groupIndex in 2"
            :key="groupIndex"
            class="trusted-by-section__communities"
            :aria-label="groupIndex === 1 ? t('home.trusted.listLabel') : undefined"
            :aria-hidden="groupIndex === 2 ? 'true' : undefined"
          >
            <template v-for="repeatIndex in 5" :key="repeatIndex">
              <li
                v-for="community in trustedCommunities"
                :key="`${repeatIndex}-${community.name}`"
                :aria-hidden="repeatIndex > 1 ? 'true' : undefined"
              >
                <AppProgressiveImage
                  class="trusted-by-section__community-image"
                  :src="community.image"
                  :placeholder-src="community.placeholderImage"
                  :alt="groupIndex === 1 && repeatIndex === 1 ? community.name : ''"
                  width="512"
                  height="512"
                  loading="lazy"
                  fit="contain"
                />
              </li>
            </template>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.trusted-by-section {
  box-sizing: border-box;
  content-visibility: auto;
  contain-intrinsic-block-size: 14rem;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding-block: var(--space-xl) 0;
  background: transparent;
  color: var(--semantic-color-text-text-primary);
  text-align: center;
}

.trusted-by-section__container {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.trusted-by-section__copy {
  display: flex;
  width: min(100%, var(--layout-reading-max-width));
  flex-direction: column;
  align-items: center;
}

.trusted-by-section h2,
.trusted-by-section p {
  margin: 0;
}

.trusted-by-section h2 {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  font-weight: var(--typography-font-weight-regular);
  line-height: var(--line-height-body);
}

.trusted-by-section p {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.trusted-by-section__viewport {
  container-type: inline-size;
  width: 100%;
  overflow: hidden;
  mask-image: linear-gradient(
    90deg,
    transparent,
    var(--global-color-black-100) 10%,
    var(--global-color-black-100) 90%,
    transparent
  );
  touch-action: pan-y;
  user-select: none;
}

.trusted-by-section__track {
  display: flex;
  width: max-content;
  align-items: center;
  animation: trusted-community-marquee 50s linear infinite;
  will-change: transform;
}

.trusted-by-section__track--enhanced {
  animation: none;
}

.trusted-by-section__communities {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--layout-page-gutter);
  margin: 0;
  padding: 0 var(--layout-page-gutter) 0 0;
  list-style: none;
}

.trusted-by-section__communities li {
  display: grid;
  width: 25cqw;
  aspect-ratio: 2.39 / 1;
  flex: none;
  place-items: center;
}

.trusted-by-section__community-image {
  width: 100%;
  height: 100%;
  background: transparent;
  filter: grayscale(1) saturate(0);
  opacity: 0.72;
  pointer-events: none;
  user-select: none;
}

.trusted-by-section__community-image :deep(img) {
  -webkit-user-drag: none;
  user-select: none;
}

@keyframes trusted-community-marquee {
  to {
    transform: translateX(-50%);
  }
}

@media (max-width: 47.99rem) {
  .trusted-by-section {
    padding-block: var(--space-lg) 0;
  }

  .trusted-by-section__communities li {
    width: 33cqw;
  }

  .trusted-by-section__community-image {
    transform: scale(1.3);
  }

  .trusted-by-section__track {
    animation-duration: 19s;
  }
}

@media (prefers-reduced-motion: reduce) {
  .trusted-by-section__viewport {
    overflow-x: auto;
    scrollbar-width: none;
  }

  .trusted-by-section__viewport::-webkit-scrollbar {
    display: none;
  }

  .trusted-by-section__track {
    animation: none;
  }

  .trusted-by-section__communities:nth-child(2) {
    display: none;
  }
}
</style>
