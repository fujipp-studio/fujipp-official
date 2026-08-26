<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { icons } from '../../../config'
import { AppFooter } from '../../../shared/layout'
import { AppButton } from '../../../shared/ui'
import {
  AboutUsSection,
  ProblemSolutionSection,
  ScrollProgressIndicator,
  TrustedBySection,
} from '../components'
import { useScrollFade } from '../composables/useScrollFade'

const heroSection = ref<HTMLElement>()
const heroFadeStyle = useScrollFade(heroSection, 'exit')
const { t } = useI18n()
const heroPortraits = [
  {
    src: '/images/home/fujipp-portrait-blue-768.webp',
    srcset:
      '/images/home/fujipp-portrait-blue-480.webp 480w, /images/home/fujipp-portrait-blue-768.webp 768w, /images/home/fujipp-portrait-blue-960.webp 960w, /images/home/fujipp-portrait-blue.webp 1372w',
  },
  {
    src: '/images/home/fujipp-portrait-cyan-768.webp',
    srcset:
      '/images/home/fujipp-portrait-cyan-480.webp 480w, /images/home/fujipp-portrait-cyan-768.webp 768w, /images/home/fujipp-portrait-cyan-960.webp 960w, /images/home/fujipp-portrait-cyan.webp 1372w',
  },
  {
    src: '/images/home/fujipp-portrait-coral-768.webp',
    srcset:
      '/images/home/fujipp-portrait-coral-480.webp 480w, /images/home/fujipp-portrait-coral-768.webp 768w, /images/home/fujipp-portrait-coral-960.webp 960w, /images/home/fujipp-portrait-coral.webp 1372w',
  },
] as const
const activeHeroPortrait = ref(0)
let heroCarouselTimer: number | undefined
let heroPointerStartX: number | undefined

function heroPortraitPosition(index: number) {
  const offset = (index - activeHeroPortrait.value + heroPortraits.length) % heroPortraits.length
  return offset === 0 ? 'active' : offset === 1 ? 'next' : 'previous'
}

function showHeroPortrait(index: number) {
  activeHeroPortrait.value = index
  startHeroCarousel()
}

function showNextHeroPortrait() {
  activeHeroPortrait.value = (activeHeroPortrait.value + 1) % heroPortraits.length
}

function showPreviousHeroPortrait() {
  activeHeroPortrait.value =
    (activeHeroPortrait.value - 1 + heroPortraits.length) % heroPortraits.length
}

function stopHeroCarousel() {
  if (heroCarouselTimer !== undefined) window.clearInterval(heroCarouselTimer)
  heroCarouselTimer = undefined
}

function startHeroCarousel() {
  stopHeroCarousel()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  heroCarouselTimer = window.setInterval(showNextHeroPortrait, 3600)
}

function startHeroSwipe(event: PointerEvent) {
  heroPointerStartX = event.clientX
}

function finishHeroSwipe(event: PointerEvent) {
  if (heroPointerStartX === undefined) return
  const distance = event.clientX - heroPointerStartX
  heroPointerStartX = undefined
  if (Math.abs(distance) < 40) return
  if (distance < 0) showNextHeroPortrait()
  else showPreviousHeroPortrait()
  startHeroCarousel()
}

onMounted(() => {
  document.documentElement.classList.add('home-section-scroll')
  startHeroCarousel()
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('home-section-scroll')
  stopHeroCarousel()
})
</script>

<template>
  <div class="home-page">
    <ScrollProgressIndicator />
    <main class="home-main">
      <section id="home-hero" ref="heroSection" class="home-hero">
        <div class="home-hero__content" :style="heroFadeStyle">
          <div class="home-hero__copy">
            <h1>{{ t('home.hero.title') }}</h1>
            <p class="home-hero__accent">{{ t('home.hero.accent') }}</p>
            <p class="home-hero__summary">{{ t('home.hero.summary') }}</p>

            <div class="home-hero__actions">
              <AppButton href="/work" :right-icon="icons.base.arrowRight">
                {{ t('home.hero.workAction') }}
              </AppButton>
            </div>
          </div>

          <div
            class="home-hero__visual"
            role="region"
            :aria-label="t('home.hero.galleryLabel')"
            @pointerdown="startHeroSwipe"
            @pointerup="finishHeroSwipe"
            @pointercancel="heroPointerStartX = undefined"
            @mouseenter="stopHeroCarousel"
            @mouseleave="startHeroCarousel"
            @focusin="stopHeroCarousel"
            @focusout="startHeroCarousel"
          >
            <button
              v-for="(portrait, index) in heroPortraits"
              :key="portrait.src"
              type="button"
              class="home-hero__portrait"
              :class="`home-hero__portrait--${heroPortraitPosition(index)}`"
              :aria-label="t('home.hero.gallerySlide', { number: index + 1 })"
              :aria-current="index === activeHeroPortrait ? 'true' : undefined"
              @click="showHeroPortrait(index)"
            >
              <img
                :src="portrait.src"
                :srcset="portrait.srcset"
                sizes="(max-width: 767px) 64vw, 352px"
                width="768"
                height="768"
                alt=""
                draggable="false"
                :fetchpriority="index === 0 ? 'high' : 'low'"
                :loading="index === 0 ? 'eager' : 'lazy'"
                decoding="async"
              />
            </button>
          </div>
        </div>
      </section>

      <ProblemSolutionSection />
      <TrustedBySection />
      <AboutUsSection />
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.home-page {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  align-items: center;
  overflow-x: clip;
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
}

.home-main {
  display: flex;
  width: 100%;
  flex: 1;
  flex-direction: column;
}

.home-hero {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  max-width: var(--layout-content-max-width);
  min-height: calc(100dvh - 4rem);
  align-items: center;
  margin-inline: auto;
  padding: var(--space-4xl) var(--layout-page-gutter);
}

.home-hero__content {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
  align-items: center;
  gap: var(--space-2xl);
}

.home-hero__copy {
  display: flex;
  width: min(100%, 36rem);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
}

.home-hero__copy h1,
.home-hero__copy p {
  margin: 0;
}

.home-hero__copy h1 {
  font-size: var(--font-size-display-large);
  font-weight: var(--typography-font-weight-bold);
  line-height: var(--line-height-display);
}

.home-hero__accent {
  color: var(--semantic-color-text-text-accent);
  font-family: var(--font-family-handwriting);
  font-size: clamp(3rem, 6vw, 5.25rem);
  line-height: 0.95;
}

.home-hero__summary {
  max-width: 34rem;
  margin-top: var(--space-sm) !important;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.home-hero__actions {
  width: min(100%, 13rem);
  margin-top: var(--space-md);
}

.home-hero__visual {
  position: relative;
  display: grid;
  width: min(100%, 34rem);
  height: min(36vw, 28rem);
  min-height: 20rem;
  min-width: 0;
  place-items: center;
  perspective: 60rem;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}

.home-hero__portrait {
  position: absolute;
  display: block;
  width: min(72%, 22rem);
  aspect-ratio: 1;
  overflow: hidden;
  border: 0;
  border-radius: var(--corner-radius-lg);
  padding: 0;
  box-shadow: var(--effect-shadow-lg);
  cursor: pointer;
  transition:
    opacity 520ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 520ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.home-hero__portrait img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  -webkit-user-drag: none;
}

.home-hero__portrait--active {
  z-index: 3;
  opacity: 1;
  transform: translateX(0) scale(1);
}

.home-hero__portrait--previous {
  z-index: 1;
  opacity: 0.58;
  filter: saturate(0.72);
  transform: translateX(-48%) skewY(1.6deg) scale(0.72);
}

.home-hero__portrait--next {
  z-index: 2;
  opacity: 0.7;
  filter: saturate(0.82);
  transform: translateX(48%) skewY(-1.6deg) scale(0.78);
}

.home-hero__portrait:focus-visible {
  outline: 3px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 3px;
}

@media (max-width: 63.99rem) {
  .home-hero__content {
    grid-template-columns: minmax(0, 1fr) minmax(14rem, 0.7fr);
  }

  .home-hero__visual {
    height: min(42vw, 23rem);
    min-height: 17rem;
  }
}

@media (max-width: 47.99rem) {
  .home-hero {
    min-height: calc(100dvh - 4rem);
    padding-block: var(--space-3xl);
  }

  .home-hero__content {
    display: flex;
    flex-direction: column-reverse;
    align-items: stretch;
    gap: var(--space-lg);
  }

  .home-hero__visual {
    width: 100%;
    height: min(72vw, 20rem);
    min-height: 14rem;
  }

  .home-hero__portrait {
    width: min(64vw, 15rem);
  }

  .home-hero__actions {
    width: min(100%, 13rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-hero__portrait {
    transition: none;
  }
}

</style>
