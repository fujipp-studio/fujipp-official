<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { totalExperienceDays, experienceMilestones } from '../config/experience-timeline'

const { t, locale } = useI18n()
// Fixed display units: 365 days per year and 30 days per month.
const elapsed = {
  years: Math.floor(totalExperienceDays / 365),
  months: Math.floor((totalExperienceDays % 365) / 30),
  days: (totalExperienceDays % 365) % 30,
  hours: 0,
  minutes: 0,
  seconds: 0,
}
const clockUnits = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'] as const
const clockElement = ref<HTMLElement>()
const revealProgress = ref(0)
const reducedMotion = ref(false)
let frame = 0
let motionQuery: MediaQueryList | undefined

function updateReveal() {
  frame = 0
  if (!clockElement.value) return
  const top = clockElement.value.getBoundingClientRect().top
  const height = window.innerHeight
  revealProgress.value = Math.max(0, Math.min(1, (height * 0.85 - top) / (height * 0.4)))
}
function scheduleReveal() {
  if (!frame) frame = window.requestAnimationFrame(updateReveal)
}
function updateMotion() {
  reducedMotion.value = motionQuery?.matches ?? false
  scheduleReveal()
}
function numberOpacity(unit: (typeof clockUnits)[number], index: number) {
  if (elapsed[unit] === 0) return 0.25
  if (reducedMotion.value) return 1
  const progress = Math.max(0, Math.min(1, revealProgress.value * 3 - index))
  return 0.25 + progress * 0.75
}
onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateMotion()
  motionQuery.addEventListener('change', updateMotion)
  window.addEventListener('scroll', scheduleReveal, { passive: true })
  window.addEventListener('resize', scheduleReveal)
})
onBeforeUnmount(() => {
  window.cancelAnimationFrame(frame)
  window.removeEventListener('scroll', scheduleReveal)
  window.removeEventListener('resize', scheduleReveal)
  motionQuery?.removeEventListener('change', updateMotion)
})

const dateLocale = computed(() =>
  locale.value === 'th' ? 'th-TH-u-ca-buddhist' : 'en-GB-u-ca-gregory',
)
function formatDate(value: string) {
  return new Intl.DateTimeFormat(dateLocale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`))
}
function formatYear(value: string) {
  return new Intl.DateTimeFormat(dateLocale.value, { year: 'numeric', timeZone: 'UTC' })
    .formatToParts(new Date(`${value}T12:00:00Z`))
    .find((part) => part.type === 'year')?.value
}
function yearRange(start: string, end: string) {
  const first = formatYear(start)
  const last = formatYear(end)
  return first === last ? first : `${first} – ${last}`
}
</script>

<template>
  <section id="about-experience" class="experience" aria-labelledby="experience-title">
    <header class="experience__header">
      <h2 id="experience-title">{{ t('about.sections.experience') }}</h2>
      <div ref="clockElement" class="experience__clock">
        <div v-for="(unit, index) in clockUnits" :key="unit" class="experience__clock-unit">
          <span class="experience__clock-value" :style="{ opacity: numberOpacity(unit, index) }">{{ String(elapsed[unit]).padStart(2, '0') }}</span>
          <span class="experience__clock-label">{{ t(`about.experience.clockUnits.${unit}`) }}</span>
        </div>
      </div>
      <p class="experience__context">{{ t('about.experience.totalLabel') }}</p>
    </header>
    <ol class="experience__timeline">
      <li
        v-for="milestone in experienceMilestones"
        :key="milestone.id"
        class="experience__milestone"
      >
        <div class="experience__period">
          <span>{{
            yearRange(milestone.start, milestone.end)
          }}</span>
          <span class="experience__dates">
            <time :datetime="milestone.start">{{ formatDate(milestone.start) }}</time>
            <span aria-hidden="true"> — </span>
            <time :datetime="milestone.end">{{ formatDate(milestone.end) }}</time>
          </span>
          <span v-if="milestone.id === 'internship'" class="experience__duration">
            {{ t('about.experience.duration') }}
          </span>
        </div>
        <div class="experience__entry">
          <span class="experience__dot" aria-hidden="true" />
          <h3>{{ t(`about.experience.timeline.${milestone.id}.title`) }}</h3>
          <p class="experience__description">
            {{ t(`about.experience.timeline.${milestone.id}.description`) }}
          </p>
          <template v-if="milestone.id === 'internship'">
            <p class="experience__company">{{ t('about.experience.company') }}</p>
            <p class="experience__stack">{{ t('about.experience.internshipStack') }}</p>
          </template>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.experience {
  box-sizing: border-box;
  width: min(100%, 72rem);
  margin-inline: auto;
  padding: var(--space-4xl) var(--layout-page-gutter);
  background: var(--semantic-color-background-bg-default);
}
.experience__header {
  display: grid;
  gap: var(--space-lg);
  margin-bottom: var(--space-3xl);
}
.experience__header h2 {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  font-weight: var(--typography-font-weight-medium);
}
.experience__clock {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--space-xs);
  width: 100%;
  font-family: var(--font-family-mono);
  font-size: clamp(1.375rem, 6.8vw, 7rem);
  font-weight: var(--typography-font-weight-medium);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.experience__clock-unit {
  position: relative;
  display: grid;
  min-width: 0;
  gap: var(--space-md);
  text-align: center;
}
.experience__clock-unit + .experience__clock-unit::before {
  position: absolute;
  top: 0;
  left: calc(var(--space-xs) / -2);
  color: var(--semantic-color-text-text-secondary);
  content: ':';
  transform: translateX(-50%);
}
.experience__clock-label {
  color: var(--semantic-color-text-text-secondary);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-small);
  font-weight: var(--typography-font-weight-regular);
  line-height: var(--line-height-label);
}
.experience__context,
.experience__entry p {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-medium);
  line-height: var(--line-height-body);
}
.experience__context {
  margin-top: var(--space-sm);
  text-align: center;
}
.experience__timeline {
  margin: 0;
  padding: 0;
  list-style: none;
}
.experience__milestone {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.experience__period {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding-block: var(--space-lg) var(--space-md);
  font-family: var(--font-family-display);
  font-size: var(--font-size-heading-h3);
  font-weight: var(--typography-font-weight-bold);
}
.experience__dates,
.experience__duration {
  color: var(--semantic-color-text-text-secondary);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-medium);
  font-weight: var(--typography-font-weight-regular);
}
.experience__entry {
  position: relative;
  display: grid;
  align-content: start;
  gap: var(--space-md);
  border-left: 1px solid var(--semantic-color-border-border-default);
  padding: var(--space-sm) 0 var(--space-2xl) var(--space-lg);
}
.experience__dot {
  position: absolute;
  top: var(--space-md);
  left: 0;
  width: var(--space-xs);
  height: var(--space-xs);
  border-radius: var(--corner-radius-full);
  background: var(--semantic-color-text-text-primary);
  transform: translateX(-50%);
}
.experience__entry h3 {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: var(--typography-font-weight-semibold);
  letter-spacing: -0.025em;
  line-height: 1.3;
}
.experience__entry .experience__company {
  color: var(--semantic-color-text-text-primary);
  font-size: var(--font-size-label-large);
}
.experience__description {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-large);
  line-height: 1.6;
}
@media (min-width: 48rem) {
  .experience {
    padding-block: var(--space-5xl);
  }
  .experience__milestone {
    grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
  }
  .experience__period {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-lg) 0 0;
  }
  .experience__entry {
    padding-left: var(--space-2xl);
    padding-bottom: var(--space-3xl);
  }
}
</style>
