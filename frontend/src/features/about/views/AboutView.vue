<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { AppFooter } from '../../../shared/layout'
import { AppButton, AppProgressiveImage } from '../../../shared/ui'
import { icons } from '../../../config'
import { useThemeStore } from '../../../stores'
import { DonationSupportSection } from '../../donation/components'
import {
  AboutContactSection,
  AboutExperienceSection,
  AboutSectionNavigation,
  SkillGroupCard,
} from '../components'
import { skillGroups } from '../config'

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
  }, 1_000)
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
              <AppButton
                href="mailto:anawat.boripakhirun@gmail.com"
                :left-icon="icons.social.email"
              >
                {{ t('about.profile.mail') }}
              </AppButton>
            </nav>
          </div>

          <div class="about-profile__portrait">
            <div class="about-profile__image">
              <AppProgressiveImage
                class="about-profile__picture"
                :class="{ 'about-profile__picture--dark': isDarkTheme }"
                :src="profileImageSrc"
                :placeholder-src="profilePlaceholderSrc"
                :alt="t('about.profile.portraitAlt')"
                width="512"
                height="512"
                loading="eager"
                fetchpriority="high"
              />
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

      <AboutExperienceSection />

      <section id="about-skills" class="about-section about-skills">
        <header class="about-skills__heading">
          <h2>{{ t('about.skills.title') }}</h2>
          <p class="about-skills__statement">
            {{ t('about.skills.description') }}
          </p>
        </header>

        <div class="about-skills__grid">
          <SkillGroupCard v-for="group in skillGroups" :key="group.titleKey" :group="group" />
        </div>
      </section>

      <AboutContactSection />

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
  background: var(--semantic-color-background-bg-default);
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
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 23rem);
  align-items: center;
  gap: clamp(var(--space-2xl), 6vw, var(--space-5xl));
}

.about-profile__content {
  max-width: 45rem;
}

.about-profile__introduction {
  max-width: 35rem;
}

.about-profile__portrait {
  position: relative;
  isolation: isolate;
  width: 100%;
}

.about-profile__image {
  position: relative;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 4 / 5;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-sm);
  background: var(--semantic-color-background-bg-surface);
}

.about-profile__picture {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.about-profile__picture--dark {
  filter: grayscale(1) brightness(1.6) contrast(0.95);
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
.about-skills__heading p {
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

.about-copy > p {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.about-skills {
  display: grid;
  gap: var(--space-3xl);
}

.about-skills__heading,
.about-skills__grid {
  width: min(100%, 72rem);
  margin-inline: auto;
}

.about-skills__heading h2 {
  margin: 0;
  max-width: 18ch;
  font-size: clamp(2.75rem, 6vw, 5rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.055em;
  line-height: 1.05;
}

.about-skills__heading h2:lang(th) {
  letter-spacing: 0;
  line-height: 1.2;
}

.about-skills__statement {
  max-width: 40rem;
  margin: var(--space-lg) 0 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.about-skills__grid {
  display: grid;
  border-bottom: 1px solid var(--semantic-color-border-border-default);
}

@media (max-width: 63.99rem) {
  .about-profile__grid {
    grid-template-columns: 1fr;
  }

  .about-profile__portrait {
    width: min(100%, 23rem);
    justify-self: center;
  }




}

@media (max-width: 47.99rem) {
  .about-section {
    padding-block: var(--space-4xl);
  }

  .about-skills {
    gap: var(--space-2xl);
  }

  .about-skills__heading h2 {
    font-size: clamp(2.75rem, 10vw, 4.5rem);
  }




  .about-profile {
    min-height: auto;
    gap: var(--space-2xl);
    padding-top: var(--space-3xl);
  }

  .about-profile__portrait {
    width: min(100%, 20rem);
  }


  .about-profile__facts {
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }

  .about-profile .about-copy h1 {
    font-size: clamp(2.75rem, 10vw, 4.5rem);
  }


}

</style>
