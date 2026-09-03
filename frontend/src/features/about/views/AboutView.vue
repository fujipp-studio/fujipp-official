<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { AppFooter } from '../../../shared/layout'
import { AppButton, AppProgressiveImage } from '../../../shared/ui'
import { icons } from '../../../config'
import { useThemeStore } from '../../../stores'
import { DonationSupportSection } from '../../donation/components'
import { AboutSectionNavigation, SkillGroupCard } from '../components'
import { experienceHighlights, skillGroups } from '../config'

const { isDarkTheme } = storeToRefs(useThemeStore())
const { t } = useI18n()
const profileImageSrc = computed(() =>
  isDarkTheme.value
    ? '/images/about/anawat-grudtoop-profile-cropped-768.webp'
    : '/images/about/anawat-grudtoop-profile-512.webp',
)
const profilePlaceholderSrc = computed(() =>
  isDarkTheme.value
    ? '/images/about/anawat-grudtoop-profile-cropped-lqip.webp'
    : '/images/about/anawat-grudtoop-profile-512-lqip.webp',
)
const birthDate = { year: 2003, month: 10, day: 26 }
const ageClock = ref(new Date())
const liveAge = computed(() => formatLiveAge(ageClock.value))
const backgroundCanvas = ref<HTMLCanvasElement>()
let ageTimer: number | undefined
let backgroundResizeObserver: ResizeObserver | undefined
let backgroundThemeObserver: MutationObserver | undefined
let backgroundFrame: number | undefined
let pointer = { x: 0, y: 0 }
let pointerTarget = { x: 0, y: 0 }
let pointerActive = false

const gridSpacing = 32
const dotRadius = 1
const hoverRadius = 112
const hoverScale = 22

type BackgroundDot = {
  x: number
  y: number
  scale: number
}

let backgroundDots: BackgroundDot[] = []
let backgroundBounds = { width: 0, height: 0 }

function syncBackgroundDots(width: number, height: number) {
  if (
    backgroundBounds.width === width &&
    backgroundBounds.height === height &&
    backgroundDots.length > 0
  ) {
    return
  }

  backgroundBounds = { width, height }
  backgroundDots = []

  for (let y = gridSpacing / 2; y < height + gridSpacing; y += gridSpacing) {
    for (let x = gridSpacing / 2; x < width + gridSpacing; x += gridSpacing) {
      backgroundDots.push({ x, y, scale: 1 })
    }
  }
}

function drawBackground() {
  const canvas = backgroundCanvas.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return false

  const bounds = canvas.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const renderWidth = Math.max(1, Math.round(bounds.width * pixelRatio))
  const renderHeight = Math.max(1, Math.round(bounds.height * pixelRatio))

  if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
    canvas.width = renderWidth
    canvas.height = renderHeight
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, bounds.width, bounds.height)
  syncBackgroundDots(bounds.width, bounds.height)

  const tokens = getComputedStyle(document.documentElement)
  const dotColor = tokens.getPropertyValue('--semantic-color-text-text-primary').trim()
  const accentColor = tokens.getPropertyValue('--semantic-color-text-text-accent').trim()
  let dotsAreMoving = false

  for (const dot of backgroundDots) {
    const distance = Math.hypot(dot.x - pointer.x, dot.y - pointer.y)
    const proximity = pointerActive && distance < hoverRadius ? 1 - distance / hoverRadius : 0
    const targetScale = 1 + (hoverScale - 1) * proximity ** 3
    const easing = targetScale > dot.scale ? 0.14 : 0.035
    dot.scale += (targetScale - dot.scale) * easing

    if (Math.abs(targetScale - dot.scale) > 0.01) dotsAreMoving = true

    context.beginPath()
    context.arc(dot.x, dot.y, dotRadius * dot.scale, 0, Math.PI * 2)
    context.fillStyle = dot.scale > 1.1 ? accentColor : dotColor
    context.globalAlpha = dot.scale > 1.1 ? 0.95 : 0.14
    context.fill()
  }

  context.globalAlpha = 1
  return dotsAreMoving
}

function animateBackground() {
  pointer.x += (pointerTarget.x - pointer.x) * 0.32
  pointer.y += (pointerTarget.y - pointer.y) * 0.32

  const pointerIsMoving =
    Math.abs(pointerTarget.x - pointer.x) > 0.1 ||
    Math.abs(pointerTarget.y - pointer.y) > 0.1
  const dotsAreMoving = drawBackground()

  if (pointerActive || pointerIsMoving || dotsAreMoving) {
    backgroundFrame = window.requestAnimationFrame(animateBackground)
    return
  }

  backgroundFrame = undefined
}

function requestBackgroundDraw() {
  if (backgroundFrame !== undefined) return
  backgroundFrame = window.requestAnimationFrame(animateBackground)
}

function handleBackgroundPointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  pointerTarget = { x: event.clientX, y: event.clientY }
  pointerActive = true
  requestBackgroundDraw()
}

function handleBackgroundPointerLeave() {
  pointerActive = false
  requestBackgroundDraw()
}

function formatLiveAge(now = new Date()) {
  let years = now.getFullYear() - birthDate.year
  let lastBirthdayYear = now.getFullYear()
  const hasReachedBirthday =
    now.getMonth() > birthDate.month ||
    (now.getMonth() === birthDate.month && now.getDate() >= birthDate.day)

  if (!hasReachedBirthday) {
    years -= 1
    lastBirthdayYear -= 1
  }

  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const lastBirthdayUtc = Date.UTC(lastBirthdayYear, birthDate.month, birthDate.day)
  const days = Math.floor((todayUtc - lastBirthdayUtc) / 86_400_000)

  return t('about.profile.age', { years, days })
}

onMounted(() => {
  document.documentElement.classList.add('about-section-scroll')
  if (backgroundCanvas.value) {
    pointer = {
      x: backgroundCanvas.value.clientWidth / 2,
      y: backgroundCanvas.value.clientHeight / 2,
    }
    pointerTarget = { ...pointer }
    backgroundResizeObserver = new ResizeObserver(() => drawBackground())
    backgroundResizeObserver.observe(backgroundCanvas.value)
    backgroundThemeObserver = new MutationObserver(() => drawBackground())
    backgroundThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    drawBackground()
  }
  ageTimer = window.setInterval(() => {
    ageClock.value = new Date()
  }, 60_000)
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('about-section-scroll')
  backgroundResizeObserver?.disconnect()
  backgroundThemeObserver?.disconnect()
  if (backgroundFrame !== undefined) window.cancelAnimationFrame(backgroundFrame)
  if (ageTimer !== undefined) window.clearInterval(ageTimer)
})
</script>

<template>
  <div
    class="about-page"
    @pointermove="handleBackgroundPointerMove"
    @pointerleave="handleBackgroundPointerLeave"
  >
    <canvas ref="backgroundCanvas" class="about-background" aria-hidden="true" />
    <AboutSectionNavigation />
    <main class="about-main">
      <section id="about-profile" class="about-section about-profile">
          <div class="about-profile__portrait">
            <div class="about-profile__image">
              <AppProgressiveImage
                class="about-profile__picture"
                :src="profileImageSrc"
                :placeholder-src="profilePlaceholderSrc"
                :alt="t('about.profile.portraitAlt')"
                width="512"
                height="512"
                loading="eager"
                fetchpriority="high"
              />
              <strong class="about-profile__name">Fuji</strong>
            </div>
            <div class="about-profile__details">
              <p class="about-profile__age">{{ liveAge }}</p>
              <p class="about-profile__location">{{ t('about.profile.location') }}</p>
            </div>
          </div>

          <div class="about-copy">
              <h1>{{ t('about.profile.name') }}</h1>
              <p>{{ t('about.profile.introduction') }}</p>
              <div class="about-profile__education">
                <span>{{ t('about.profile.education') }}</span>
                <strong>{{ t('about.profile.university') }}</strong>
              </div>
              <nav class="about-profile__links" :aria-label="t('about.profile.contactLinks')">
                <AppButton
                  href="https://github.com/Fujipp"
                  target="_blank"
                  rel="noopener noreferrer"
                  :left-icon="icons.social.github"
                >
                  GitHub
                </AppButton>
                <AppButton
                  href="https://www.linkedin.com/in/anawat-boripakhirun-aa1799426"
                  target="_blank"
                  rel="noopener noreferrer"
                  :left-icon="icons.social.linkedin"
                >
                  LinkedIn
                </AppButton>
                <AppButton
                  href="mailto:anawat.boripakhirun@gmail.com"
                  :left-icon="icons.social.email"
                >
                  {{ t('about.profile.mail') }}
                </AppButton>
              </nav>
          </div>
      </section>

      <section id="about-experience" class="about-section about-experience">
        <header class="about-experience__heading">
          <h2>{{ t('about.experience.title') }}</h2>
          <div class="about-experience__summary">
            <div class="about-experience__role">
              <strong>{{ t('about.experience.role') }}</strong>
              <span>{{ t('about.experience.duration') }}</span>
            </div>
            <p>{{ t('about.experience.company') }}</p>
          </div>
        </header>

        <div class="about-experience__grid">
          <article v-for="(highlight, index) in experienceHighlights" :key="highlight.titleKey">
            <span class="about-experience__number" aria-hidden="true">0{{ index + 1 }}</span>
            <h3>{{ t(highlight.titleKey) }}</h3>
            <p>{{ t(highlight.descriptionKey) }}</p>
          </article>
        </div>
      </section>

      <section id="about-skills" class="about-section about-skills">
        <header class="about-skills__heading">
          <div>
            <h2>{{ t('about.skills.title') }}</h2>
          </div>
          <p class="about-skills__statement">
            {{ t('about.skills.description') }}
          </p>
        </header>

        <div class="about-skills__grid">
          <SkillGroupCard v-for="group in skillGroups" :key="group.titleKey" :group="group" />
        </div>
      </section>

      <section id="about-contact" class="about-section about-contact">
        <div class="about-contact__container">
          <div class="about-copy">
            <h2>{{ t('about.contact.title') }}</h2>
            <p>{{ t('about.contact.description') }}</p>
            <ul class="about-contact__roles" :aria-label="t('about.contact.rolesLabel')">
              <li>{{ t('about.contact.frontend') }}</li>
              <li>{{ t('about.contact.backend') }}</li>
              <li>{{ t('about.contact.fullStack') }}</li>
              <li>{{ t('about.contact.automation') }}</li>
            </ul>
          </div>

          <div class="about-contact__action">
            <span>{{ t('about.contact.emailLabel') }}</span>
            <a href="mailto:anawat.boripakhirun@gmail.com">anawat.boripakhirun@gmail.com</a>
            <AppButton
              variant="primary"
              href="mailto:anawat.boripakhirun@gmail.com"
              :left-icon="icons.social.email"
            >
              {{ t('about.contact.action') }}
            </AppButton>
          </div>
        </div>
      </section>

      <DonationSupportSection />
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.about-page {
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

.about-background {
  position: fixed;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.about-main {
  position: relative;
  z-index: 1;
  width: 100%;
}

.about-section {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--layout-content-max-width);
  min-height: calc(100dvh - 4rem);
  margin-inline: auto;
  padding: var(--space-4xl) var(--layout-page-gutter);
}

.about-contact {
  display: flex;
  align-items: center;
  justify-content: center;
}

.about-contact__container {
  box-sizing: border-box;
  display: flex;
  width: min(100%, 66rem);
  align-items: center;
  justify-content: space-between;
  gap: clamp(var(--space-lg), 5vw, var(--space-4xl));
  border: 1px solid color-mix(
    in srgb,
    var(--semantic-color-border-border-default) 35%,
    transparent
  );
  border-radius: var(--corner-radius-lg);
  padding: var(--space-4xl);
  background: color-mix(
    in srgb,
    var(--semantic-color-background-bg-inverse) 70%,
    transparent
  );
  color: var(--semantic-color-text-text-inverse);
  backdrop-filter: blur(var(--effect-backdrop-blur-sm));
}

.about-contact__container .about-eyebrow,
.about-contact__container .about-copy > p:not(.about-eyebrow) {
  color: var(--semantic-color-text-text-inverse);
}

.about-profile {
  position: relative;
  display: grid;
  overflow: hidden;
  max-width: none;
  grid-template-columns: minmax(18rem, 26rem) minmax(0, 38rem);
  align-items: center;
  justify-content: center;
  gap: clamp(var(--space-2xl), 7vw, 7rem);
  background: transparent;
  color: var(--semantic-color-text-text-primary);
  padding-inline: max(
    var(--layout-page-gutter),
    calc((100vw - var(--layout-content-max-width)) / 2 + var(--layout-page-gutter))
  );
}

.about-profile__portrait {
  position: relative;
  z-index: 2;
  width: 100%;
  flex-shrink: 0;
}

.about-profile__image {
  position: relative;
  z-index: 1;
  overflow: hidden;
  width: 100%;
  height: auto;
  aspect-ratio: 4 / 5;
  margin-inline: auto;
  border: 1px solid color-mix(in srgb, var(--global-color-white-100) 16%, transparent);
  border-radius: var(--corner-radius-lg);
  background: var(--semantic-color-background-bg-surface);
}

.about-profile__picture {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 320ms ease;
}

.about-profile__name {
  position: absolute;
  z-index: 2;
  right: var(--space-md);
  bottom: var(--space-md);
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--corner-radius-sm);
  background: rgb(0 0 0 / 72%);
  color: var(--semantic-color-text-text-inverse);
  font-family: var(--font-family-display);
  font-size: var(--font-size-heading-h2);
  line-height: var(--line-height-heading);
  text-shadow: 0 2px 12px rgb(0 0 0 / 45%);
  white-space: nowrap;
}

.about-profile__details {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
}

.about-profile__age,
.about-profile__location {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.about-profile .about-profile__age,
.about-profile .about-profile__location {
  color: var(--semantic-color-text-text-secondary);
}

.about-profile .about-copy {
  position: relative;
  z-index: 2;
  margin-top: 0;
}

.about-profile .about-copy > p:not(.about-eyebrow) {
  color: var(--semantic-color-text-text-secondary);
}

.about-profile .about-eyebrow {
  color: var(--semantic-color-text-text-accent);
}

.about-copy {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-md);
}

.about-profile__links {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.about-copy h1,
.about-copy h2,
.about-copy p,
.about-skills__heading h2,
.about-skills__heading p,
.about-experience__heading h2,
.about-experience__heading p {
  margin: 0;
}

.about-copy h1 {
  align-self: stretch;
  font-size: clamp(3rem, 7vw, 6.5rem);
  font-weight: var(--typography-font-weight-medium);
  letter-spacing: -0.06em;
  line-height: 0.9;
}

.about-profile__education {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: var(--space-xxs);
  border-top: 1px solid var(--semantic-color-border-border-default);
  padding-top: var(--space-md);
}

.about-profile__education span {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-medium);
}

.about-profile__education strong {
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.about-copy > p:not(.about-eyebrow),
.about-experience__heading > p:not(.about-eyebrow) {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.about-eyebrow {
  color: var(--semantic-color-text-text-accent);
  font-size: var(--font-size-body-large);
  font-weight: var(--typography-font-weight-semibold);
  line-height: var(--line-height-heading);
}

.about-skills {
  display: flex;
  width: 100%;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-2xl);
}

.about-skills__heading,
.about-experience__heading,
.about-experience__grid {
  width: min(100%, 66rem);
  margin-inline: auto;
}

.about-experience__heading h2 {
  font-size: var(--font-size-heading-h1);
  line-height: var(--line-height-heading);
}

.about-skills__heading {
  display: grid;
  width: min(100%, 66rem);
  grid-template-columns: 1fr minmax(16rem, 24rem);
  align-items: end;
  gap: var(--space-xl);
  border-bottom: 1px solid var(--semantic-color-border-border-default);
  padding-bottom: var(--space-xl);
}

.about-skills__heading h2 {
  margin-top: 0;
  font-size: clamp(3rem, 8vw, 6.5rem);
  font-weight: var(--typography-font-weight-medium);
  letter-spacing: -0.06em;
  line-height: 0.9;
}

.about-skills__statement {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.about-skills__grid {
  display: grid;
  width: min(100%, 66rem);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-md);
  margin-inline: auto;
}

.about-skills__grid :deep(.skill-group-card) {
  display: flex;
  flex-direction: column;
  align-self: start;
  justify-content: flex-start;
  gap: var(--space-lg);
  border: 1px solid color-mix(
    in srgb,
    var(--semantic-color-border-border-default) 70%,
    transparent
  );
  border-radius: var(--corner-radius-lg);
  padding: var(--space-xl);
  background: color-mix(
    in srgb,
    var(--semantic-color-background-bg-surface) 82%,
    transparent
  );
  backdrop-filter: none;
  text-align: left;
}

.about-skills__grid :deep(.skill-group-card h3) {
  margin: 0;
  font-size: var(--font-size-heading-h3);
}

.about-skills__grid :deep(.skill-group-card ul) {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.about-skills__grid :deep(.skill-group-card li) {
  min-width: 0;
  min-height: 2.75rem;
  border-color: color-mix(
    in srgb,
    var(--semantic-color-border-border-default) 65%,
    transparent
  );
  border-radius: var(--corner-radius-md);
  padding: var(--space-xs) var(--space-sm);
  background: var(--semantic-color-background-bg-default);
  font-size: var(--font-size-label-medium);
  white-space: nowrap;
}

.about-skills__grid :deep(.skill-group-card--language) {
  grid-column: auto;
}

.about-skills__grid :deep(.skill-group-card--frontend) {
  grid-column: auto;
}

.about-skills__grid :deep(.skill-group-card--backend) {
  grid-column: auto;
}

.about-skills__grid :deep(.skill-group-card--database) {
  grid-column: auto;
}

.about-skills__grid :deep(.skill-group-card--infra) {
  grid-column: 1 / -1;
}

.about-experience {
  display: flex;
  max-width: none;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-xl);
  background: transparent;
  color: var(--semantic-color-text-text-primary);
}

.about-experience__heading {
  display: grid;
  width: min(100%, 66rem);
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 24rem);
  align-items: end;
  gap: var(--space-xl);
  margin-inline: auto;
  border-bottom: 1px solid var(--semantic-color-border-border-default);
  padding-bottom: var(--space-xl);
}

.about-experience__heading h2 {
  margin: 0;
  font-size: clamp(2.75rem, 7vw, 6rem);
  font-weight: var(--typography-font-weight-medium);
  letter-spacing: -0.055em;
  line-height: 0.94;
  white-space: pre-line;
}

.about-experience__summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.about-experience__summary p {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  line-height: var(--line-height-body);
}

.about-experience__role {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xxs);
  font-size: var(--font-size-label-large);
  line-height: var(--line-height-label);
}

.about-experience__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-lg);
}

.about-experience__grid article {
  display: grid;
  min-height: 15rem;
  grid-template-rows: auto 1fr auto;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  padding: var(--space-xl);
  background: color-mix(
    in srgb,
    var(--semantic-color-background-bg-surface) 82%,
    transparent
  );
  color: var(--semantic-color-text-text-primary);
}

.about-experience__number {
  color: var(--semantic-color-text-text-secondary);
  font-family: var(--font-family-mono);
  font-size: var(--font-size-label-medium);
}

.about-experience__grid h3,
.about-experience__grid p {
  margin: 0;
}

.about-experience__grid h3 {
  align-self: end;
  font-size: var(--font-size-heading-h3);
  line-height: var(--line-height-heading);
}

.about-experience__grid p {
  margin-top: var(--space-sm);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-medium);
  line-height: var(--line-height-body);
}

.about-contact__container .about-copy {
  width: min(100%, 38rem);
}

.about-contact__container h2 {
  font-size: clamp(2.75rem, 6vw, 5.5rem);
  font-weight: var(--typography-font-weight-medium);
  letter-spacing: -0.055em;
  line-height: 0.92;
}

.about-contact__roles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin: var(--space-sm) 0 0;
  padding: 0;
  list-style: none;
}

.about-contact__roles li {
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  border-radius: var(--corner-radius-full);
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-label-medium);
}

.about-contact__action {
  display: flex;
  min-width: 18rem;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm);
  border-inline-start: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  padding-inline-start: var(--space-xl);
}

.about-contact__action span {
  font-size: var(--font-size-label-medium);
}

.about-contact__action > a {
  color: inherit;
  font-size: var(--font-size-body-medium);
  text-decoration: none;
}

@media (max-width: 63.99rem) {
  .about-contact__container {
    flex-direction: column;
  }

  .about-profile {
    min-height: calc(100dvh - 4rem);
    flex-direction: column;
    padding-block: var(--space-5xl);
  }

  .about-profile .about-copy {
    margin-inline: auto;
  }

  .about-profile__portrait {
    width: min(100%, 22rem);
  }

  .about-skills__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .about-skills__grid :deep(.skill-group-card) {
    grid-column: auto;
  }

  .about-skills__grid :deep(.skill-group-card--infra) {
    grid-column: 1 / -1;
  }

  .about-contact__action {
    width: 100%;
    border-inline-start: 0;
    border-top: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    padding-block-start: var(--space-xl);
    padding-inline-start: 0;
  }
}

@media (max-width: 47.99rem) {
  .about-section {
    min-height: auto;
    padding-block: var(--space-5xl);
  }

  .about-experience__grid {
    grid-template-columns: 1fr;
  }

  .about-experience__heading {
    grid-template-columns: 1fr;
  }

  .about-contact__container {
    align-items: flex-start;
    padding: var(--space-2xl) var(--space-md);
    text-align: left;
  }

  .about-skills__heading {
    grid-template-columns: 1fr;
  }

  .about-profile {
    min-height: auto;
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .about-profile__portrait {
    width: min(100%, 20rem);
  }

  .about-profile .about-copy h1 {
    font-size: clamp(2.5rem, 12vw, 4rem);
  }

  .about-profile__links {
    grid-template-columns: 1fr;
  }

  .about-skills__grid :deep(.skill-group-card) {
    grid-column: 1;
  }

  .about-skills__grid {
    grid-template-columns: 1fr;
  }

  .about-experience__role {
    flex-direction: column;
    gap: var(--space-xs);
  }
}

</style>
