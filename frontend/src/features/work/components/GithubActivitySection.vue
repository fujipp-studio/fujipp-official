<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { useQuery } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { type WorkLocale } from '@/features/work/api'
import { AppButton } from '../../../shared/ui/buttons'
import { githubActivityQuery } from '../queries'

const props = defineProps<{ locale: WorkLocale }>()

const GITHUB_PROFILE_URL = 'https://github.com/Fujipp'
const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const
const currentYear = new Date().getFullYear()
const contributionYearOptions = [
  { label: 'Last year', value: 'last' },
  ...Array.from({ length: 5 }, (_, index) => {
    const year = String(currentYear - index)
    return { label: year, value: year }
  }),
]

const contributionYear = ref('last')
const loadingStarted = ref(false)
const activity = useQuery(computed(() => ({
  ...githubActivityQuery(contributionYear.value), enabled: loadingStarted.value, shallow: true,
})))
const contributionData = activity.data
const contributionTotal = computed(() => contributionData.value?.total ?? null)
const contributionError = computed(() => !contributionData.value && activity.isError.value)
const sectionElement = ref<HTMLElement>()
let observer: IntersectionObserver | undefined

const copy = computed(() =>
  props.locale === 'th'
    ? {
        title: 'GitHub Activity',
        contributions: 'contributions ในช่วงปีที่ผ่านมา',
        unavailable: 'ไม่สามารถโหลด GitHub Activity ได้ในขณะนี้',
        loading: 'กำลังโหลดข้อมูลจาก GitHub…',
        retry: 'ลองอีกครั้ง',
      }
    : {
        title: 'GitHub Activity',
        contributions: 'contributions in the last year',
        unavailable: 'GitHub activity is temporarily unavailable.',
        loading: 'Loading GitHub activity…',
        retry: 'Try again',
      },
)

// Format each day once when its data or locale changes, then reuse its label
// for both the tooltip and accessible name without allocating per render.
const calendarWeeks = computed(() => {
  const formatter = new Intl.DateTimeFormat(props.locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  })
  const monthFormatter = new Intl.DateTimeFormat(props.locale, { month: 'short', timeZone: 'UTC' })
  return (contributionData.value?.contributions ?? []).map((week, index, weeks) => {
    const firstDate = week[0]?.date
    const sameMonth = firstDate?.slice(0, 7) === weeks[index - 1]?.[0]?.date.slice(0, 7)
    return {
      month:
        firstDate && !sameMonth ? monthFormatter.format(new Date(`${firstDate}T00:00:00Z`)) : '',
      days: week.map((day) => {
        const contributionText =
          day.count === 0
            ? props.locale === 'th' ? 'ไม่มีกิจกรรม' : 'No activity'
            : `${day.count} ${day.count === 1 ? 'contribution' : 'contributions'}`
        const query = new URLSearchParams({ tab: 'overview', from: day.date, to: day.date })
        return {
          ...day,
          label: `${formatter.format(new Date(`${day.date}T00:00:00Z`))} · ${contributionText}`,
          url: `${GITHUB_PROFILE_URL}?${query.toString()}`,
        }
      }),
    }
  })
})

async function loadContributions(force = false) {
  if (force) await activity.refetch()
  else loadingStarted.value = true
}

function startLoading() {
  if (loadingStarted.value) return
  loadingStarted.value = true
  observer?.disconnect()
  observer = undefined
  void loadContributions()
}

onMounted(() => {
  if (!('IntersectionObserver' in window)) {
    startLoading()
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) startLoading()
    },
    { rootMargin: '300px 0px' },
  )
  if (sectionElement.value) observer.observe(sectionElement.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section
    ref="sectionElement"
    class="github-activity page-container"
    aria-labelledby="github-activity-title"
  >
    <div class="github-activity__panel">
      <header class="github-activity__header">
        <div>
          <h2 id="github-activity-title">{{ copy.title }}</h2>
        </div>

      </header>

      <div class="github-activity__toolbar">
        <p aria-live="polite">
          <template v-if="contributionTotal !== null">
            <strong>{{ contributionTotal.toLocaleString(props.locale) }}</strong>
            {{ copy.contributions }}
          </template>
          <template v-else-if="contributionError">{{ copy.unavailable }}</template>
          <template v-else>{{ copy.loading }}</template>
        </p>

        <div class="year-picker" aria-label="Contribution year">
          <button
            v-for="option in contributionYearOptions"
            :key="option.value"
            type="button"
            :class="{ active: contributionYear === option.value }"
            :aria-pressed="contributionYear === option.value"
            @click="contributionYear = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div v-if="contributionData" class="contribution-scroller">
        <div
          class="contribution-calendar"
          :style="{ '--contribution-week-count': calendarWeeks.length }"
          aria-label="GitHub contribution calendar"
        >
          <div class="calendar-body">
            <div class="month-spacer" aria-hidden="true" />
            <div class="month-labels" aria-hidden="true">
              <span v-for="(week, index) in calendarWeeks" :key="index">{{ week.month }}</span>
            </div>
            <div class="weekday-labels" aria-hidden="true">
              <span v-for="(label, index) in weekdayLabels" :key="`${label}-${index}`">{{ label }}</span>
            </div>
            <div class="contribution-weeks">
              <div v-for="(week, weekIndex) in calendarWeeks" :key="weekIndex" class="contribution-week">
                <a
                  v-for="day in week.days"
                  :key="day.date"
                  class="contribution-day"
                  :href="day.url"
                  target="_blank"
                  rel="noreferrer"
                  :data-intensity="day.intensity"
                  :data-tooltip="day.label"
                  :aria-label="day.label"
                />
              </div>
            </div>
          </div>

          <div class="contribution-legend" aria-label="Contribution intensity legend">
            <span>Less</span>
            <span v-for="intensity in 5" :key="intensity" class="contribution-day" :data-intensity="intensity - 1" />
            <span>More</span>
          </div>
        </div>
      </div>

      <div v-else-if="contributionError" class="github-activity__error">
        <AppButton class="github-activity__retry" @click="loadContributions(true)">
          <span class="github-activity__button-label">
            <RotateCcw :size="17" aria-hidden="true" />
            {{ copy.retry }}
          </span>
        </AppButton>
      </div>

      <div v-else class="github-activity__loading" aria-hidden="true">
        <span v-for="index in 20" :key="index" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.github-activity {
  margin-top: var(--space-5xl);
}

.github-activity__panel {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: clamp(var(--space-xl), 4vw, var(--space-3xl));
  border: 1px solid color-mix(in srgb, var(--semantic-color-border-border-default) 70%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--semantic-color-background-bg-surface) 72%, transparent);
  box-shadow: var(--effect-shadow-lg);
  backdrop-filter: blur(1.5rem) saturate(1.25);
}

.github-activity__panel::before {
  position: absolute;
  z-index: -2;
  inset: -28%;
  background:
    radial-gradient(
      circle at 22% 24%,
      color-mix(in srgb, var(--semantic-color-text-text-accent) 54%, transparent),
      transparent 34%
    ),
    radial-gradient(
      circle at 74% 70%,
      color-mix(in srgb, var(--semantic-color-background-bg-inverse) 32%, transparent),
      transparent 42%
    ),
    radial-gradient(
      circle at 58% 18%,
      color-mix(in srgb, var(--semantic-color-success-success-text) 20%, transparent),
      transparent 30%
    );
  content: '';
  filter: blur(3rem);
  opacity: 0.72;
  pointer-events: none;
  transform: scale(1.08);
}

.github-activity__panel::after {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: color-mix(in srgb, var(--semantic-color-background-bg-default) 58%, transparent);
  content: '';
  pointer-events: none;
}

.github-activity__header,
.github-activity__toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-xl);
}

.github-activity__header h2 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.75rem);
  letter-spacing: -0.045em;
  line-height: 1;
}

.github-activity__toolbar p {
  margin: var(--space-sm) 0 0;
  color: var(--semantic-color-text-text-secondary);
}

.github-activity__retry {
  width: max-content;
}

.github-activity__button-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

.github-activity__toolbar {
  margin-top: var(--space-2xl);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--semantic-color-border-border-subtle);
  align-items: center;
}

.github-activity__toolbar p {
  margin: 0;
}

.github-activity__toolbar strong {
  color: var(--semantic-color-text-text-primary);
  font-size: var(--font-size-heading-h2);
}

.year-picker {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-xs);
}

.year-picker button {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--semantic-color-text-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-body-small);
}

.year-picker button:hover,
.year-picker button.active {
  border-color: var(--semantic-color-border-border-default);
  background: var(--semantic-color-background-bg-surface-hover);
  color: var(--semantic-color-text-text-primary);
}

.contribution-scroller {
  width: 100%;
  margin-top: var(--space-xl);
  overflow-x: auto;
  padding-block: var(--space-lg) var(--space-sm);
  scrollbar-width: thin;
  scrollbar-color: var(--semantic-color-border-border-default) transparent;
}

.contribution-scroller::-webkit-scrollbar {
  height: 0.375rem;
}

.contribution-scroller::-webkit-scrollbar-thumb {
  border-radius: var(--radius-full);
  background: var(--semantic-color-border-border-default);
}

.contribution-calendar {
  display: flex;
  width: max-content;
  min-width: 100%;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  font-size: 0.625rem;
}

.calendar-body {
  display: grid;
  grid-template-columns: 1.5rem auto;
  gap: 0.3125rem;
}

.month-spacer,
.month-labels {
  height: 0.875rem;
}

.month-labels {
  display: grid;
  grid-template-columns: repeat(var(--contribution-week-count), 1.5rem);
  gap: 0.3125rem;
  text-align: left;
}

.month-labels span {
  width: 2rem;
  overflow: visible;
  font-weight: var(--typography-font-weight-bold);
  white-space: nowrap;
}

.weekday-labels,
.contribution-week {
  display: flex;
  width: 1.5rem;
  flex-direction: column;
  gap: 0.3125rem;
}

.weekday-labels span {
  height: 1.5rem;
  line-height: 1.5rem;
}

.contribution-weeks {
  display: flex;
  gap: 0.3125rem;
}

.contribution-day {
  position: relative;
  box-sizing: border-box;
  display: block;
  width: 1.5rem;
  height: 1.5rem;
  flex: none;
  border: 1px solid color-mix(in srgb, var(--semantic-color-text-text-muted) 42%, transparent);
  border-radius: 0.1875rem;
  background: color-mix(
    in srgb,
    var(--semantic-color-background-bg-surface) 84%,
    var(--semantic-color-text-text-muted) 16%
  );
  cursor: pointer;
  text-decoration: none;
}

.contribution-day[data-intensity='1'] {
  border-color: color-mix(
    in srgb,
    var(--semantic-color-success-success-border) 72%,
    var(--semantic-color-border-border-default)
  );
  background: color-mix(
    in srgb,
    var(--semantic-color-success-success-bg) 82%,
    var(--semantic-color-success-success-text) 18%
  );
}

.contribution-day[data-intensity='2'] {
  border-color: var(--semantic-color-success-success-border);
  background: color-mix(in srgb, var(--semantic-color-success-success-text) 38%, transparent);
}

.contribution-day[data-intensity='3'] {
  border-color: var(--semantic-color-success-success-text);
  background: color-mix(in srgb, var(--semantic-color-success-success-text) 68%, transparent);
}

.contribution-day[data-intensity='4'] {
  border-color: var(--semantic-color-success-success-text);
  background: var(--semantic-color-success-success-text);
}

.contribution-day::before {
  position: absolute;
  z-index: 3;
  bottom: calc(100% + 0.5rem);
  left: 50%;
  width: max-content;
  max-width: min(11rem, 72vw);
  padding: var(--space-xxs) var(--space-xs);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--radius-sm);
  background: var(--semantic-color-background-bg-surface);
  box-shadow: var(--effect-shadow-sm);
  color: var(--semantic-color-text-text-secondary);
  content: attr(data-tooltip);
  font-size: 0.6875rem;
  font-weight: var(--typography-font-weight-medium);
  line-height: 1.3;
  opacity: 0;
  pointer-events: none;
  text-align: center;
  transform: translate(-50%, 0.25rem);
  transition: opacity 140ms ease, transform 140ms ease;
  white-space: normal;
}

.contribution-day:hover::before,
.contribution-day:focus-visible::before {
  opacity: 1;
  transform: translate(-50%, 0);
}

.contribution-legend {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--semantic-color-text-text-muted);
}

.contribution-legend .contribution-day::before {
  display: none;
}

.contribution-legend .contribution-day {
  cursor: default;
}

.github-activity__loading {
  display: grid;
  grid-template-columns: repeat(10, 0.75rem);
  justify-content: center;
  margin-top: var(--space-2xl);
  gap: var(--space-xs);
}

.github-activity__loading span {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 0.1875rem;
  background: var(--semantic-color-background-bg-surface-hover);
  animation: github-pulse 1s ease-in-out infinite alternate;
}

.github-activity__error {
  display: grid;
  margin-top: var(--space-xl);
  place-items: center;
}

@keyframes github-pulse {
  to { opacity: 0.35; }
}

@media (max-width: 47.99rem) {
  .github-activity {
    margin-top: var(--space-4xl);
  }

  .github-activity__header,
  .github-activity__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .year-picker {
    justify-content: flex-start;
  }

  .contribution-calendar {
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .github-activity__loading span {
    animation: none;
  }
}
</style>
