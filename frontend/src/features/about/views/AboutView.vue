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
let ageTimer: number | undefined

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
  ageTimer = window.setInterval(() => {
    ageClock.value = new Date()
  }, 60_000)
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('about-section-scroll')
  if (ageTimer !== undefined) window.clearInterval(ageTimer)
})
</script>

<template>
  <div class="about-page">
    <AboutSectionNavigation />
    <main class="about-main">
      <section id="about-profile" class="about-section about-profile">
        <div class="about-profile__grid">
          <div class="about-copy about-profile__content">
            <p class="about-profile__eyebrow">{{ t('about.sections.profile') }}</p>
            <h1>{{ t('about.profile.name') }}</h1>
            <p class="about-profile__introduction">{{ t('about.profile.introduction') }}</p>
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
              <AppButton href="mailto:anawat.boripakhirun@gmail.com" :left-icon="icons.social.email">
                {{ t('about.profile.mail') }}
              </AppButton>
            </nav>
          </div>

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
          </div>
        </div>

        <div class="about-profile__facts">
          <div class="about-profile__details">
            <p class="about-profile__age">{{ liveAge }}</p>
            <p class="about-profile__location">{{ t('about.profile.location') }}</p>
          </div>
          <div class="about-profile__education">
            <span>{{ t('about.profile.education') }}</span>
            <strong>{{ t('about.profile.university') }}</strong>
          </div>
        </div>
      </section>

      <section id="about-experience" class="about-section about-experience">
        <div class="about-experience__inner">
          <header class="about-experience__heading">
            <div class="about-experience__intro">
              <p class="about-experience__eyebrow">{{ t('about.sections.experience') }}</p>
              <h2>{{ t('about.experience.title') }}</h2>
            </div>
            <div class="about-experience__summary">
              <span class="about-experience__duration">{{ t('about.experience.duration') }}</span>
              <div class="about-experience__role">
                <strong>{{ t('about.experience.role') }}</strong>
                <p>{{ t('about.experience.company') }}</p>
              </div>
            </div>
          </header>

          <ol class="about-experience__list">
            <li v-for="(highlight, index) in experienceHighlights" :key="highlight.titleKey">
              <span class="about-experience__number" aria-hidden="true">0{{ index + 1 }}</span>
              <div class="about-experience__item-copy">
                <h3>{{ t(highlight.titleKey) }}</h3>
                <p>{{ t(highlight.descriptionKey) }}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section id="about-skills" class="about-section about-skills">
        <header class="about-skills__heading">
          <p class="about-skills__eyebrow">{{ t('about.sections.skills') }}</p>
          <h2>{{ t('about.skills.title') }}</h2>
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
            <p class="about-contact__eyebrow">{{ t('about.sections.contact') }}</p>
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
            <span class="about-contact__arrow" aria-hidden="true">↗</span>
            <span class="about-contact__email-label">{{ t('about.contact.emailLabel') }}</span>
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

.about-main {
  position: relative;
  z-index: 1;
  width: 100%;
}

.about-section {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--layout-content-max-width);
  margin-inline: auto;
  padding: var(--space-5xl) var(--layout-page-gutter);
}

.about-profile {
  position: relative;
  display: grid;
  min-height: calc(100dvh - 4rem);
  align-content: center;
  gap: var(--space-4xl);
}

.about-profile__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 27rem);
  align-items: center;
  gap: clamp(var(--space-2xl), 6vw, var(--space-5xl));
}

.about-profile__content {
  max-width: 45rem;
}

.about-profile__eyebrow {
  color: var(--semantic-color-text-text-accent);
  font-size: var(--font-size-label-medium);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.about-profile__introduction {
  max-width: 35rem;
}

.about-profile__portrait {
  position: relative;
  isolation: isolate;
  width: 100%;
}

.about-profile__portrait::before {
  position: absolute;
  z-index: -1;
  inset: -8%;
  border-radius: var(--corner-radius-full);
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--semantic-color-text-text-accent) 16%, transparent),
    transparent 70%
  );
  content: '';
}

.about-profile__image {
  position: relative;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 4 / 5;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  background: var(--semantic-color-background-bg-surface);
  box-shadow: var(--effect-shadow-lg);
}

.about-profile__picture {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.about-profile__name {
  position: absolute;
  z-index: 2;
  right: var(--space-md);
  bottom: var(--space-md);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-full);
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
  font-family: var(--font-family-display);
  font-size: var(--font-size-label-large);
  line-height: var(--line-height-label);
  white-space: nowrap;
}

.about-profile__details {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-lg);
}

.about-profile__facts {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-lg);
  border-top: 1px solid var(--semantic-color-border-border-default);
  padding-top: var(--space-lg);
}

.about-profile__age,
.about-profile__location {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-medium);
  line-height: var(--line-height-label);
}

.about-profile .about-copy {
  gap: var(--space-lg);
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
  width: min(100%, 30rem);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-sm);
  margin-top: var(--space-sm);
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
  font-size: clamp(3.5rem, 6.5vw, 6.5rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.055em;
  line-height: 0.98;
}

.about-profile h1:lang(th) {
  letter-spacing: 0;
  line-height: 1.2;
}

.about-profile__education {
  display: grid;
  width: 100%;
  gap: var(--space-xs);
}

.about-profile__education span {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-medium);
}

.about-profile__education strong {
  font-size: var(--font-size-body-medium);
  line-height: var(--line-height-body);
}

.about-copy > p:not(.about-eyebrow):not(.about-profile__eyebrow):not(.about-contact__eyebrow),
.about-experience__heading > p:not(.about-eyebrow) {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.about-skills,
.about-experience {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-xl);
}

.about-skills__heading {
  display: flex;
  width: min(100%, 72rem);
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  margin-inline: auto;
  text-align: center;
}

.about-skills__heading h2,
.about-experience__heading h2 {
  margin-top: 0;
  font-size: clamp(3rem, 7vw, 6rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.055em;
  line-height: 0.94;
}

.about-experience__heading h2 {
  white-space: pre-line;
}

.about-skills__statement,
.about-experience__summary p {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.about-skills {
  gap: var(--space-3xl);
}

.about-skills__eyebrow {
  color: var(--semantic-color-text-text-accent);
  font-size: var(--font-size-label-medium);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.about-skills__heading h2 {
  max-width: 18ch;
  font-size: clamp(3.5rem, 7vw, 6.5rem);
  line-height: 0.98;
}

.about-skills__heading h2:lang(th) {
  letter-spacing: 0;
  line-height: 1.2;
}

.about-skills__statement {
  max-width: 40rem;
}

.about-skills__grid {
  display: grid;
  width: min(100%, 72rem);
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--space-md);
  margin-inline: auto;
}

.about-skills__grid :deep(.skill-group-card) {
  display: flex;
  min-height: 18rem;
  grid-column: span 5;
  flex-direction: column;
  align-self: stretch;
  justify-content: space-between;
  gap: var(--space-2xl);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-lg);
  padding: var(--space-xl);
  background:
    radial-gradient(
      circle at 90% 0,
      color-mix(in srgb, var(--semantic-color-text-text-accent) 8%, transparent),
      transparent 60%
    ),
    var(--semantic-color-background-bg-surface);
  box-shadow: var(--effect-shadow-sm);
  text-align: left;
  transition: box-shadow 180ms ease;
}

.about-skills__grid :deep(.skill-group-card:hover) {
  box-shadow: var(--effect-shadow-lg);
}

.about-skills__grid :deep(.skill-group-card h3) {
  position: relative;
  z-index: 1;
  align-items: flex-start;
  margin: 0;
  font-size: clamp(1.75rem, 2.4vw, 2.25rem);
  letter-spacing: -0.035em;
  line-height: 1.1;
}

.about-skills__grid :deep(.skill-group-card h3 svg) {
  flex-shrink: 0;
}

.about-skills__grid :deep(.skill-group-card__art) {
  opacity: 0.12;
}

.about-skills__grid :deep(.skill-group-card ul) {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.about-skills__grid :deep(.skill-group-card li) {
  min-width: 0;
  min-height: 2.75rem;
  border-color: var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-full);
  padding: var(--space-xs) var(--space-sm);
  background: var(--semantic-color-background-bg-default);
  font-size: var(--font-size-label-medium);
  white-space: nowrap;
}

.about-skills__grid :deep(.technology-icon) {
  box-sizing: border-box;
  border-radius: var(--corner-radius-sm);
  padding: var(--space-xxs);
  background: var(--semantic-color-action-backgrounds-bg-primary);
}

.about-skills__grid :deep(.skill-group-card--frontend),
.about-skills__grid :deep(.skill-group-card--database) {
  grid-column: span 7;
}

.about-skills__grid :deep(.skill-group-card--frontend) {
  border-color: transparent;
  background:
    radial-gradient(
      circle at 90% 0,
      color-mix(in srgb, var(--semantic-color-text-text-accent) 18%, transparent),
      transparent 60%
    ),
    var(--semantic-color-background-bg-inverse);
  color: var(--semantic-color-text-text-inverse);
}

.about-skills__grid :deep(.skill-group-card--frontend li) {
  border-color: color-mix(in srgb, currentColor 20%, transparent);
  background: color-mix(in srgb, currentColor 10%, transparent);
  color: inherit;
}

.about-skills__grid :deep(.skill-group-card--infra) {
  grid-column: 1 / -1;
  min-height: 14rem;
  flex-direction: row;
  align-items: flex-end;
}

.about-skills__grid :deep(.skill-group-card--infra ul) {
  max-width: 34rem;
  justify-content: flex-end;
}

.about-experience {
  max-width: none;
  background:
    radial-gradient(
      circle at 85% 8%,
      color-mix(in srgb, var(--semantic-color-text-text-accent) 10%, transparent),
      transparent 32rem
    ),
    var(--semantic-color-background-bg-surface);
}

.about-experience__inner {
  width: min(100%, 72rem);
  margin-inline: auto;
}

.about-experience__heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 20rem);
  align-items: center;
  gap: var(--space-3xl);
  margin-bottom: var(--space-3xl);
}

.about-experience__intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm);
}

.about-experience__eyebrow {
  color: var(--semantic-color-text-text-accent);
  font-size: var(--font-size-label-medium);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.about-experience__heading h2 {
  font-size: clamp(3.5rem, 7vw, 6.5rem);
  line-height: 0.95;
}

.about-experience__heading h2:lang(th) {
  letter-spacing: 0;
  line-height: 1.22;
}

.about-experience__summary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-md);
  border-top: 1px solid var(--semantic-color-border-border-default);
  padding-top: var(--space-lg);
}

.about-experience__duration {
  font-family: var(--font-family-display);
  font-size: clamp(3.25rem, 5vw, 5rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.06em;
  line-height: 1;
}

.about-experience__role {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--font-size-label-large);
  line-height: var(--line-height-label);
}

.about-experience__list {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--space-md);
  margin-block: 0;
  padding: 0;
  list-style: none;
}

.about-experience__list li {
  display: flex;
  min-height: 18rem;
  grid-column: span 5;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-2xl);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-lg);
  padding: var(--space-xl);
  background:
    radial-gradient(
      circle at 95% 0,
      color-mix(in srgb, var(--semantic-color-text-text-accent) 9%, transparent),
      transparent 65%
    ),
    var(--semantic-color-background-bg-default);
  box-shadow: var(--effect-shadow-sm);
  transition: box-shadow 180ms ease;
}

.about-experience__list li:nth-child(4n + 1),
.about-experience__list li:nth-child(4n + 4) {
  grid-column: span 7;
  border-color: transparent;
  background:
    radial-gradient(
      circle at 95% 0,
      color-mix(in srgb, var(--semantic-color-text-text-accent) 18%, transparent),
      transparent 60%
    ),
    var(--semantic-color-background-bg-inverse);
  color: var(--semantic-color-text-text-inverse);
}

.about-experience__list li:hover {
  box-shadow: var(--effect-shadow-lg);
}

.about-experience__item-copy {
  display: flex;
  max-width: 32rem;
  flex-direction: column;
  gap: var(--space-sm);
}

.about-experience__number {
  color: var(--semantic-color-text-text-secondary);
  font-family: var(--font-family-display);
  font-size: clamp(3rem, 5vw, 4.5rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.08em;
  line-height: 0.9;
  opacity: 0.45;
}

.about-experience__list li:nth-child(4n + 1) .about-experience__number,
.about-experience__list li:nth-child(4n + 4) .about-experience__number {
  color: inherit;
}

.about-experience__list h3,
.about-experience__list p {
  margin: 0;
}

.about-experience__list h3 {
  font-size: clamp(1.5rem, 2.2vw, 2rem);
  letter-spacing: -0.035em;
  line-height: 1.12;
}

.about-experience__list h3:lang(th) {
  letter-spacing: 0;
  line-height: 1.3;
}

.about-experience__list p {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.about-experience__list li:nth-child(4n + 1) p,
.about-experience__list li:nth-child(4n + 4) p {
  color: inherit;
  opacity: 0.78;
}

.about-contact {
  max-width: none;
  background:
    radial-gradient(
      circle at 85% 10%,
      color-mix(in srgb, var(--semantic-color-text-text-accent) 17%, transparent),
      transparent 34rem
    ),
    var(--semantic-color-background-bg-inverse);
  color: var(--semantic-color-text-text-inverse);
}

.about-contact__container {
  display: grid;
  width: min(100%, 72rem);
  min-height: 34rem;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
  align-items: end;
  gap: var(--space-3xl);
  margin-inline: auto;
}

.about-contact__container .about-copy {
  width: min(100%, 48rem);
  gap: var(--space-lg);
}

.about-contact__eyebrow {
  color: var(--semantic-color-text-text-accent);
  font-size: var(--font-size-label-medium);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.about-contact__container .about-copy > p:not(.about-contact__eyebrow) {
  max-width: 37rem;
  color: var(--semantic-color-text-text-inverse);
  opacity: 0.76;
}

.about-contact__container h2 {
  max-width: 14ch;
  font-size: clamp(3.5rem, 6vw, 6.5rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.055em;
  line-height: 1;
}

.about-contact__container h2:lang(th) {
  letter-spacing: 0;
  line-height: 1.2;
}

.about-contact__roles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin: var(--space-md) 0 0;
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
  min-width: 0;
  min-height: 20rem;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-lg);
  padding: var(--space-xl);
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
  box-shadow: var(--effect-shadow-lg);
}

.about-contact__arrow {
  align-self: flex-end;
  font-size: clamp(3rem, 5vw, 4.5rem);
  line-height: 0.8;
}

.about-contact__email-label {
  margin-top: auto;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-medium);
}

.about-contact__action > a {
  color: inherit;
  font-size: var(--font-size-body-medium);
  font-weight: var(--typography-font-weight-semibold);
  overflow-wrap: anywhere;
  text-decoration: none;
}

.about-contact__action > a:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.about-contact__action :deep(.app-button) {
  margin-top: var(--space-sm);
  border-color: transparent;
  background: var(--semantic-color-background-bg-inverse);
  box-shadow: none;
  color: var(--semantic-color-text-text-inverse);
  backdrop-filter: none;
}

.about-contact__action :deep(.app-button:hover) {
  background: var(--semantic-color-background-bg-inverse);
  transform: none;
}

@media (max-width: 63.99rem) {
  .about-contact__container {
    grid-template-columns: 1fr;
    gap: var(--space-2xl);
  }

  .about-profile__grid {
    grid-template-columns: 1fr;
  }

  .about-profile__portrait {
    width: min(100%, 26rem);
    justify-self: center;
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

  .about-skills__grid :deep(.skill-group-card--infra ul) {
    max-width: 28rem;
  }

  .about-contact__action {
    width: 100%;
    min-height: 16rem;
  }
}

@media (max-width: 47.99rem) {
  .about-section {
    padding-block: var(--space-4xl);
  }

  .about-experience__heading {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
    margin-bottom: var(--space-2xl);
  }

  .about-experience__heading h2 {
    font-size: clamp(2.75rem, 10vw, 4.5rem);
  }

  .about-experience__summary {
    gap: var(--space-sm);
  }

  .about-experience__duration {
    font-size: var(--font-size-heading-h1);
  }

  .about-experience__list {
    grid-template-columns: 1fr;
  }

  .about-experience__list li:nth-child(n) {
    min-height: 14rem;
    grid-column: 1;
    padding: var(--space-lg);
  }

  .about-experience__number {
    font-size: var(--font-size-heading-h1);
  }

  .about-contact__container {
    min-height: 0;
  }

  .about-contact__container h2 {
    font-size: clamp(2.75rem, 10vw, 4.5rem);
  }

  .about-skills {
    gap: var(--space-2xl);
  }

  .about-skills__heading h2 {
    font-size: clamp(2.75rem, 10vw, 4.5rem);
  }

  .about-skills__grid :deep(.skill-group-card) {
    min-height: 14rem;
  }

  .about-skills__grid :deep(.skill-group-card--infra) {
    flex-direction: column;
    align-items: flex-start;
  }

  .about-skills__grid :deep(.skill-group-card--infra ul) {
    justify-content: flex-start;
  }

  .about-profile {
    min-height: auto;
    gap: var(--space-2xl);
    padding-top: var(--space-3xl);
  }

  .about-profile__portrait {
    width: min(100%, 24rem);
  }

  .about-profile__image {
    aspect-ratio: 1;
  }

  .about-profile__facts {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }

  .about-profile .about-copy h1 {
    font-size: clamp(2.75rem, 10vw, 4.5rem);
  }

  .about-skills__grid :deep(.skill-group-card) {
    grid-column: 1;
  }

  .about-skills__grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .about-skills__grid :deep(.skill-group-card) {
    transition: none;
  }
}
</style>
