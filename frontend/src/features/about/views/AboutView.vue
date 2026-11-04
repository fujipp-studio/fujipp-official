<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowUpRight, Github, Linkedin, Mail } from 'lucide-vue-next'

import { AppFooter } from '../../../shared/layout'
import { DonationSupportSection } from '../../donation/components'
import {
  AboutContactSection,
  AboutExperienceSection,
  AboutSectionNavigation,
  AboutPortraitGallery,
  TechnologyOrbit,
} from '../components'

const { t } = useI18n()
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
            <nav class="about-profile__links" :aria-label="t('about.profile.contactLinks')">
              <a
                class="about-profile__link"
                href="https://github.com/Fujipp"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github class="about-profile__link-icon" aria-hidden="true" />
                <span class="about-profile__link-label">GitHub</span>
                <ArrowUpRight class="about-profile__link-arrow" aria-hidden="true" />
              </a>
              <a
                class="about-profile__link"
                href="https://www.linkedin.com/in/anawat-boripakhirun-aa1799426"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin class="about-profile__link-icon" aria-hidden="true" />
                <span class="about-profile__link-label">LinkedIn</span>
                <ArrowUpRight class="about-profile__link-arrow" aria-hidden="true" />
              </a>
              <a
                class="about-profile__link"
                href="mailto:anawat.boripakhirun@gmail.com"
              >
                <Mail class="about-profile__link-icon" aria-hidden="true" />
                <span class="about-profile__link-label">{{ t('about.profile.mail') }}</span>
                <ArrowUpRight class="about-profile__link-arrow" aria-hidden="true" />
              </a>
            </nav>
          </div>

          <div class="about-profile__portrait">
            <AboutPortraitGallery />
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

      <section
        id="about-skills"
        class="about-section about-skills"
        :aria-label="t('about.sections.skills')"
      >
        <TechnologyOrbit class="about-skills__visual" />
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
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 28rem);
  align-items: center;
  gap: clamp(var(--space-2xl), 6vw, var(--space-5xl));
}

.about-profile__content {
  max-width: 45rem;
}

.about-profile__portrait {
  position: relative;
  isolation: isolate;
  width: 100%;
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
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-sm);
  margin-top: var(--space-sm);
}

.about-profile__link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xxs);
  padding-block: var(--space-xs);
  color: var(--semantic-color-text-text-primary);
  font-size: var(--font-size-label-medium);
  font-weight: var(--typography-font-weight-medium);
  line-height: var(--line-height-body);
  text-decoration: none;
}

.about-profile__link-icon {
  width: var(--icon-size-24);
  height: var(--icon-size-24);
  flex: 0 0 var(--icon-size-24);
  stroke-width: 1.75;
}

.about-profile__link-arrow {
  width: var(--icon-size-16);
  height: var(--icon-size-16);
  stroke-width: 1.75;
}

.about-profile__link-label {
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: var(--space-xxs);
  transition: text-decoration-color 160ms ease;
}

.about-profile__link:hover .about-profile__link-label,
.about-profile__link:focus-visible .about-profile__link-label {
  text-decoration-color: currentColor;
}

.about-profile__link:focus-visible {
  border-radius: var(--corner-radius-sm);
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: var(--space-xxs);
}

@media (min-width: 48rem) {
  .about-profile__links {
    column-gap: var(--space-lg);
  }

  .about-profile__link {
    font-size: var(--font-size-heading-h4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .about-profile__link-label {
    transition: none;
  }
}

.about-copy h1,
.about-copy h2,
.about-copy p {
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
  justify-items: center;
  padding-block: calc(var(--space-3xl) + var(--space-md)) var(--space-2xl);
  scroll-margin-block-start: var(--space-md);
}

.about-skills__visual {
  max-width: var(--layout-reading-max-width);
  margin-inline: auto;
}

@media (max-width: 63.99rem) {
  .about-profile__grid {
    grid-template-columns: 1fr;
  }

  .about-profile__portrait {
    width: min(100%, 28rem);
    justify-self: center;
  }




}

@media (max-width: 47.99rem) {
  .about-section {
    padding-block: var(--space-4xl);
  }

  .about-skills {
    padding-block: calc(var(--space-3xl) + var(--space-md)) var(--space-2xl);
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
