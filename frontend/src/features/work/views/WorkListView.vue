<script setup lang="ts">
import {
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { fetchWorks, type WorkLocale, type WorkSummary } from '../../../services/backend'
import { AppFooter } from '../../../shared/layout'
import { AppButton, AppToast } from '../../../shared/ui'
import GithubActivitySection from '../components/GithubActivitySection.vue'
import WorkCategoryFilter from '../components/WorkCategoryFilter.vue'

const { locale: appLocale } = useI18n()
const locale = ref<WorkLocale>(appLocale.value === 'th' ? 'th' : 'en')
const selectedCategory = ref('all')
const selectedFeaturedCategory = ref('all')
const workPageSize = ref(6)
const visibleWorkCount = ref(6)
const works = ref<WorkSummary[]>([])
const loading = ref(true)
const retrying = ref(false)
const error = ref('')
const toastOpen = ref(false)
const worksCache = new Map<WorkLocale, WorkSummary[]>()
const featuredViewport = ref<HTMLElement>()
const featuredPaused = ref(false)
const featuredCanScroll = ref(false)
const activeSection = ref(0)
let featuredTimer: ReturnType<typeof setInterval> | undefined
let sectionAnimationFrame: number | undefined

const copy = computed(() =>
  locale.value === 'th'
    ? {
        featuredTitle: 'ผลงานเด่น',
        projectsTitle: 'โปรเจกต์ทั้งหมด',
        featuredAll: 'ทั้งหมด',
        all: 'ทั้งหมด',
        showing: 'กำลังแสดง',
        of: 'จาก',
        projects: 'โปรเจกต์',
        loadMore: 'แสดงเพิ่มเติม',
        showLess: 'แสดงน้อยลง',
        empty: 'ยังไม่มีผลงานในหมวดหมู่นี้',
        retry: 'ลองอีกครั้ง',
        retrying: 'กำลังโหลด…',
        loadFailed: 'โหลดโปรเจกต์ไม่สำเร็จ กรุณาลองอีกครั้ง',
        view: 'ดูรายละเอียด',
      }
    : {
        featuredTitle: 'Featured work',
        projectsTitle: 'All projects',
        featuredAll: 'All',
        all: 'All work',
        showing: 'Showing',
        of: 'of',
        projects: 'projects',
        loadMore: 'Load more',
        showLess: 'Show less',
        empty: 'There are no projects in this category yet.',
        retry: 'Try again',
        retrying: 'Loading…',
        loadFailed: 'Could not load projects. Please try again.',
        view: 'View case study',
      },
)

const categories = computed(() => {
  const unique = new Map<string, string>()
  for (const work of works.value) unique.set(work.category.code, work.category.name)
  return [...unique].map(([code, name]) => ({ code, name }))
})

const filteredWorks = computed(() =>
  selectedCategory.value === 'all'
    ? works.value
    : works.value.filter((work) => work.category.code === selectedCategory.value),
)

const visibleFilteredWorks = computed(() => filteredWorks.value.slice(0, visibleWorkCount.value))

const featuredWorks = computed(() => works.value.filter((work) => work.featured))
const showFeaturedSection = computed(
  () => !error.value && (loading.value || featuredWorks.value.length > 0),
)
const workSectionIds = computed(() =>
  showFeaturedSection.value
    ? ['featured-work', 'all-projects', 'github-activity']
    : ['all-projects', 'github-activity'],
)

const featuredCategories = computed(() => {
  const unique = new Map<string, string>()
  for (const work of featuredWorks.value) unique.set(work.category.code, work.category.name)
  return [...unique].map(([code, name]) => ({ code, name }))
})

const filteredFeaturedWorks = computed(() =>
  selectedFeaturedCategory.value === 'all'
    ? featuredWorks.value
    : featuredWorks.value.filter(
        (work) => work.category.code === selectedFeaturedCategory.value,
      ),
)

function applyWorks(nextWorks: WorkSummary[]) {
  works.value = nextWorks
  if (
    selectedCategory.value !== 'all' &&
    !nextWorks.some((work) => work.category.code === selectedCategory.value)
  ) {
    selectedCategory.value = 'all'
  }
  if (
    selectedFeaturedCategory.value !== 'all' &&
    !nextWorks.some(
      (work) => work.featured && work.category.code === selectedFeaturedCategory.value,
    )
  ) {
    selectedFeaturedCategory.value = 'all'
  }
  requestAnimationFrame(() => {
    updateFeaturedCanScroll()
  })
}

async function getWorks(value: WorkLocale) {
  const cachedWorks = worksCache.get(value)
  if (cachedWorks) return cachedWorks

  const nextWorks = await fetchWorks(value)
  worksCache.set(value, nextWorks)
  return nextWorks
}

async function loadWorks(showSkeleton = true) {
  if (showSkeleton) {
    loading.value = true
    error.value = ''
  }

  try {
    applyWorks(await getWorks(locale.value))
    error.value = ''
    void getWorks(locale.value === 'en' ? 'th' : 'en').catch(() => undefined)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load portfolio projects.'
    toastOpen.value = false
    requestAnimationFrame(() => {
      toastOpen.value = true
    })
  } finally {
    if (showSkeleton) loading.value = false
  }
}

async function retryLoadWorks() {
  if (retrying.value) return

  retrying.value = true
  try {
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await Promise.all([
      loadWorks(false),
      new Promise<void>((resolve) => window.setTimeout(resolve, 600)),
    ])
  } finally {
    retrying.value = false
  }
}

function formatStatus(status: WorkSummary['status']) {
  return status.toLowerCase().replaceAll('_', ' ')
}

function selectCategory(category: string) {
  if (selectedCategory.value === category) return
  selectedCategory.value = category
  visibleWorkCount.value = workPageSize.value
}

function updateWorkPageSize() {
  const previousPageSize = workPageSize.value
  const nextPageSize = window.matchMedia('(max-width: 47.99rem)').matches ? 4 : 6
  workPageSize.value = nextPageSize

  if (visibleWorkCount.value <= previousPageSize) visibleWorkCount.value = nextPageSize
}

function loadMoreWorks() {
  visibleWorkCount.value = Math.min(
    filteredWorks.value.length,
    visibleWorkCount.value + workPageSize.value,
  )
}

function showFewerWorks() {
  visibleWorkCount.value = workPageSize.value
  document.getElementById('all-projects')?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
}

function selectFeaturedCategory(category: string) {
  if (selectedFeaturedCategory.value === category) return

  selectedFeaturedCategory.value = category
  requestAnimationFrame(() => {
    featuredViewport.value?.scrollTo({ left: 0, behavior: 'smooth' })
    updateFeaturedCanScroll()
  })
}

function updateFeaturedCanScroll() {
  const viewport = featuredViewport.value
  featuredCanScroll.value = Boolean(viewport && viewport.scrollWidth > viewport.clientWidth + 1)

  if (featuredCanScroll.value) startFeaturedAutoplay()
  else stopFeaturedAutoplay()
}

function updateActiveSection() {
  sectionAnimationFrame = undefined
  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY

  workSectionIds.value.forEach((id, index) => {
    const section = document.getElementById(id)
    if (!section) return

    const distance = Math.abs(section.getBoundingClientRect().top - 64)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  })

  activeSection.value = closestIndex
}

function requestSectionUpdate() {
  if (sectionAnimationFrame === undefined) {
    sectionAnimationFrame = window.requestAnimationFrame(updateActiveSection)
  }
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
}

function scrollFeatured(direction: 1 | -1) {
  const viewport = featuredViewport.value
  if (!viewport) return

  const card = viewport.querySelector<HTMLElement>('.featured-card')
  const distance = (card?.offsetWidth ?? viewport.clientWidth * 0.82) + 20
  const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
  const reachedEnd = direction === 1 && viewport.scrollLeft >= maxScroll - 4

  viewport.scrollTo({
    left: reachedEnd ? 0 : Math.min(maxScroll, Math.max(0, viewport.scrollLeft + distance * direction)),
    behavior: 'smooth',
  })
}

function stopFeaturedAutoplay() {
  if (featuredTimer) clearInterval(featuredTimer)
  featuredTimer = undefined
}

function startFeaturedAutoplay() {
  stopFeaturedAutoplay()
  if (
    !featuredCanScroll.value ||
    filteredFeaturedWorks.value.length < 2 ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return
  }

  featuredTimer = setInterval(() => {
    if (!featuredPaused.value) scrollFeatured(1)
  }, 4200)
}

watch(filteredFeaturedWorks, startFeaturedAutoplay)
watch(workSectionIds, () => requestSectionUpdate())
watch(
  appLocale,
  async (value) => {
    const nextLocale: WorkLocale = value === 'th' ? 'th' : 'en'
    if (nextLocale === locale.value) return
    locale.value = nextLocale
    error.value = ''
    try {
      applyWorks(await getWorks(nextLocale))
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'Unable to load portfolio projects.'
      toastOpen.value = true
    }
  },
)
onMounted(() => {
  void loadWorks()
  updateWorkPageSize()
  document.documentElement.classList.add('work-section-scroll')
  window.addEventListener('scroll', requestSectionUpdate, { passive: true })
  window.addEventListener('resize', requestSectionUpdate)
  window.addEventListener('resize', updateFeaturedCanScroll)
  window.addEventListener('resize', updateWorkPageSize)
  updateActiveSection()
})
onBeforeUnmount(() => {
  stopFeaturedAutoplay()
  document.documentElement.classList.remove('work-section-scroll')
  window.removeEventListener('scroll', requestSectionUpdate)
  window.removeEventListener('resize', requestSectionUpdate)
  window.removeEventListener('resize', updateFeaturedCanScroll)
  window.removeEventListener('resize', updateWorkPageSize)
  if (sectionAnimationFrame !== undefined) window.cancelAnimationFrame(sectionAnimationFrame)
})
</script>

<template>
  <div class="work-page">
    <main class="work-main">
      <section
        v-if="showFeaturedSection"
        id="featured-work"
        class="featured-section"
        aria-labelledby="featured-heading"
      >
        <div class="featured-section__header page-container">
          <div>
            <h1 id="featured-heading">{{ copy.featuredTitle }}</h1>
          </div>
        </div>

        <div v-if="!loading && !error" class="featured-filter-row page-container">
          <WorkCategoryFilter
            :model-value="selectedFeaturedCategory"
            :all-label="copy.featuredAll"
            :options="featuredCategories"
            label="Featured project categories"
            @update:model-value="selectFeaturedCategory"
          />
        </div>

        <div v-if="loading" class="featured-rail featured-rail--loading" aria-busy="true">
          <article v-for="index in 3" :key="index" class="featured-card featured-card--loading">
            <div class="skeleton skeleton--featured" />
          </article>
        </div>

        <Transition name="featured-content" mode="out-in" @after-enter="updateFeaturedCanScroll">
          <div
            v-if="!loading && filteredFeaturedWorks.length"
            :key="selectedFeaturedCategory"
            ref="featuredViewport"
            class="featured-rail"
            aria-label="Featured projects"
            @mouseenter="featuredPaused = true"
            @mouseleave="featuredPaused = false"
            @focusin="featuredPaused = true"
            @focusout="featuredPaused = false"
            @pointerdown="featuredPaused = true"
            @pointerup="featuredPaused = false"
          >
          <article
            v-for="(work, index) in filteredFeaturedWorks"
            :key="work.slug"
            class="featured-card"
          >
            <RouterLink
              class="featured-card__visual-link"
              :to="{ name: 'work-detail', params: { slug: work.slug }, query: locale === 'th' ? { locale: 'th' } : {} }"
              :aria-label="`${copy.view}: ${work.name}`"
            >
              <div class="featured-card__visual">
                <img
                  v-if="work.cover"
                  :src="work.cover.url"
                  :alt="work.cover.altText ?? ''"
                  :loading="index === 0 ? 'eager' : 'lazy'"
                  decoding="async"
                  :fetchpriority="index === 0 ? 'high' : 'low'"
                />
                <div v-else class="featured-card__placeholder" aria-hidden="true">
                  <span>{{ work.name }}</span>
                </div>
              </div>
            </RouterLink>

            <div class="featured-card__copy">
              <div class="featured-card__meta">
                <span>{{ work.category.name }}</span>
                <span>{{ formatStatus(work.status) }}</span>
              </div>
              <h2>{{ work.name }}</h2>
              <p>{{ work.shortDescription }}</p>
              <RouterLink
                class="featured-card__link"
                :to="{ name: 'work-detail', params: { slug: work.slug }, query: locale === 'th' ? { locale: 'th' } : {} }"
              >
                {{ copy.view }}
              </RouterLink>
            </div>
          </article>
          </div>
        </Transition>

        <div v-if="featuredCanScroll" class="carousel-controls carousel-controls--bottom page-container">
          <button type="button" aria-label="Previous featured project" @click="scrollFeatured(-1)">
            <ChevronLeft :size="22" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Next featured project" @click="scrollFeatured(1)">
            <ChevronRight :size="22" aria-hidden="true" />
          </button>
        </div>
      </section>

      <div
        id="all-projects"
        class="work-catalog page-container"
        :class="{ 'work-catalog--primary': !showFeaturedSection }"
      >
      <h2 class="work-catalog__title">{{ copy.projectsTitle }}</h2>
      <WorkCategoryFilter
        v-if="!loading && !error"
        class="work-filters"
        :model-value="selectedCategory"
        :all-label="copy.all"
        :options="categories"
        label="Project categories"
        @update:model-value="selectCategory"
      />

      <section v-if="loading" class="work-grid" aria-label="Loading projects" aria-busy="true">
        <article v-for="index in 3" :key="index" class="work-card work-card--loading">
          <div class="skeleton skeleton--media" />
          <div class="skeleton skeleton--line" />
          <div class="skeleton skeleton--line skeleton--short" />
        </article>
      </section>

      <section v-else-if="error" class="work-state">
        <BriefcaseBusiness :size="32" aria-hidden="true" />
        <h2>Could not load work</h2>
        <AppButton class="work-state__retry" :disabled="retrying" @click="retryLoadWorks">
          {{ retrying ? copy.retrying : copy.retry }}
        </AppButton>
      </section>

      <section v-else-if="filteredWorks.length === 0" class="work-state">
        <BriefcaseBusiness :size="32" aria-hidden="true" />
        <h2>{{ copy.empty }}</h2>
      </section>

      <Transition v-else name="work-content" mode="out-in">
      <section :key="selectedCategory" class="work-grid" aria-label="Portfolio projects">
        <RouterLink
          v-for="work in visibleFilteredWorks"
          :key="work.slug"
          class="work-card"
          :to="{ name: 'work-detail', params: { slug: work.slug }, query: locale === 'th' ? { locale: 'th' } : {} }"
        >
          <div class="work-card__media">
            <img
              v-if="work.cover"
              :src="work.cover.url"
              :alt="work.cover.altText ?? ''"
              loading="lazy"
              decoding="async"
            />
            <div v-else class="work-card__placeholder" aria-hidden="true">
              <span>{{ work.name.slice(0, 1) }}</span>
            </div>
            <span class="work-card__status">{{ formatStatus(work.status) }}</span>
          </div>

          <div class="work-card__body">
            <div class="work-card__meta">
              <span>{{ work.category.name }}</span>
              <span v-if="work.featured">Featured</span>
            </div>
            <h2>{{ work.name }}</h2>
            <p>{{ work.shortDescription }}</p>
            <ul aria-label="Technologies">
              <li v-for="technology in work.technologies.slice(0, 5)" :key="technology.slug">
                {{ technology.name }}
              </li>
            </ul>
            <span class="work-card__link">
              {{ copy.view }}
            </span>
          </div>
        </RouterLink>
      </section>
      </Transition>

      <div v-if="!loading && !error && filteredWorks.length" class="work-pagination">
        <p>
          {{ copy.showing }} {{ Math.min(visibleWorkCount, filteredWorks.length) }}
          {{ copy.of }} {{ filteredWorks.length }} {{ copy.projects }}
        </p>
        <div class="work-pagination__actions">
          <AppButton
            v-if="visibleWorkCount < filteredWorks.length"
            class="work-pagination__button"
            @click="loadMoreWorks"
          >
            {{ copy.loadMore }}
          </AppButton>
          <AppButton
            v-if="visibleWorkCount > workPageSize"
            class="work-pagination__button"
            variant="secondary"
            @click="showFewerWorks"
          >
            {{ copy.showLess }}
          </AppButton>
        </div>
      </div>
      </div>

      <GithubActivitySection id="github-activity" :locale="locale" />
    </main>

    <nav class="section-indicator" aria-label="Work page sections">
      <button
        v-for="(id, index) in workSectionIds"
        :key="id"
        type="button"
        :class="{ active: activeSection === index }"
        :aria-label="`Go to ${id.replaceAll('-', ' ')}`"
        :aria-current="activeSection === index ? 'step' : undefined"
        @click="scrollToSection(id)"
      >
        <span aria-hidden="true" />
      </button>
    </nav>

    <AppFooter />
    <AppToast v-model:open="toastOpen" :message="copy.loadFailed" variant="error" />
  </div>
</template>

<style scoped>
.work-page {
  --work-navbar-height: 4rem;

  display: flex;
  min-height: 100dvh;
  margin-top: calc(-1 * var(--work-navbar-height));
  padding-top: var(--work-navbar-height);
  flex-direction: column;
  background:
    radial-gradient(circle at 82% 6%, color-mix(in srgb, var(--semantic-color-text-text-accent) 10%, transparent), transparent 28rem),
    var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
}

@media (max-width: 47.99rem) {
  .work-page {
    --work-navbar-height: 3rem;
  }
}

.work-main {
  width: 100%;
  flex: 1;
  padding-block: var(--space-3xl) var(--space-5xl);
}

.featured-section {
  overflow: visible;
}

.featured-section__header {
  padding-block: var(--space-3xl) var(--space-lg);
}

.featured-section__header > div:first-child {
  max-width: 48rem;
}

.featured-section h1 {
  max-width: 46rem;
  margin: 0;
  font-size: clamp(2.6rem, 6vw, 5.25rem);
  line-height: 1;
  letter-spacing: -0.055em;
}

.featured-filter-row {
  padding-bottom: var(--space-lg);
  overflow-x: auto;
  scrollbar-width: none;
}

.featured-filter-row::-webkit-scrollbar {
  display: none;
}

.carousel-controls {
  display: flex;
  gap: var(--space-xs);
}

.carousel-controls--bottom {
  align-items: center;
  justify-content: flex-end;
  padding-top: var(--space-xs);
}

.carousel-controls button {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid color-mix(in srgb, var(--semantic-color-border-border-default) 60%, transparent);
  border-radius: var(--radius-full);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 80%, transparent),
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 60%, transparent)
    ),
    transparent;
  box-shadow: var(--effect-glass-highlight), var(--effect-shadow-button);
  color: var(--semantic-color-text-text-primary);
  cursor: pointer;
  place-items: center;
  backdrop-filter: blur(0) saturate(1.5);
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease,
    transform 100ms ease-out;
}

.carousel-controls button:hover {
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 95%, transparent),
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 70%, transparent)
    ),
    transparent;
  transform: translateY(1px) scale(0.99);
}

.carousel-controls button:active {
  box-shadow: var(--effect-shadow-sm);
  transform: translateY(2px) scale(0.97);
}

.featured-rail {
  display: flex;
  gap: var(--space-lg);
  overflow-x: auto;
  padding-block: var(--space-sm) var(--space-xl);
  padding-inline:
    max(
      var(--layout-page-gutter),
      calc((100vw - var(--layout-content-max-width)) / 2 + var(--layout-page-gutter))
    );
  scroll-behavior: smooth;
  scroll-padding-inline: var(--layout-page-gutter);
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  overscroll-behavior-inline: contain;
}

.featured-rail::-webkit-scrollbar {
  display: none;
}

.featured-content-enter-active,
.featured-content-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.featured-content-enter-from {
  opacity: 0;
  transform: translateY(0.5rem);
}

.featured-content-leave-to {
  opacity: 0;
  transform: translateY(-0.35rem);
}

.featured-card {
  position: relative;
  display: flex;
  width: clamp(17rem, 22vw, 19.5rem);
  flex: none;
  flex-direction: column;
  border: 0;
  background: transparent;
  color: inherit;
  scroll-snap-align: start;
}

.featured-card__visual-link {
  display: block;
  color: inherit;
  text-decoration: none;
}

.featured-card__copy {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 16rem;
  flex-direction: column;
  align-items: center;
  padding: var(--space-lg) var(--space-sm) var(--space-sm);
  text-align: center;
}

.featured-card__meta {
  display: flex;
  justify-content: center;
  gap: var(--space-sm);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-small);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.featured-card h2 {
  margin: var(--space-sm) 0 var(--space-xs);
  font-size: clamp(1.5rem, 2.2vw, 2rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.featured-card p {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-small);
  line-height: var(--line-height-body);
}

.featured-card__link {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  margin-top: auto;
  padding: var(--space-xs) var(--space-md);
  border: 1px solid color-mix(in srgb, var(--semantic-color-border-border-default) 60%, transparent);
  border-radius: 0.75rem;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 80%, transparent),
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 60%, transparent)
    ),
    transparent;
  box-shadow: var(--effect-glass-highlight), var(--effect-shadow-button);
  gap: var(--space-xs);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-label-large);
  font-weight: var(--typography-font-weight-medium);
  line-height: var(--line-height-label);
  color: var(--semantic-color-text-text-primary);
  text-decoration: none;
  backdrop-filter: blur(0) saturate(1.5);
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease,
    transform 100ms ease-out;
}

.featured-card__link:hover {
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 95%, transparent),
      color-mix(in srgb, var(--semantic-color-background-bg-glass) 70%, transparent)
    ),
    transparent;
  transform: translateY(1px) scale(0.99);
}

.featured-card__visual {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--semantic-color-background-bg-surface);
  box-shadow: var(--effect-shadow-sm);
  transition:
    box-shadow 220ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.featured-card__visual-link:hover .featured-card__visual {
  box-shadow: var(--effect-shadow-lg);
  transform: translateY(-0.4rem) scale(1.015);
}

.featured-card__visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.featured-card__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 25% 20%, color-mix(in srgb, var(--semantic-color-text-text-accent) 52%, transparent), transparent 36%),
    radial-gradient(circle at 78% 72%, color-mix(in srgb, var(--semantic-color-text-text-accent) 24%, transparent), transparent 40%),
    var(--semantic-color-background-bg-surface-hover);
}

.featured-card__placeholder span {
  max-width: 84%;
  overflow: hidden;
  opacity: 0.16;
  font-size: clamp(2rem, 3.6vw, 3.5rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.06em;
  text-align: center;
  white-space: nowrap;
}

.featured-card--loading {
  min-height: 28rem;
  padding: var(--space-sm);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--semantic-color-background-bg-surface);
}

.skeleton--featured {
  width: 100%;
  height: 100%;
}

.work-catalog {
  margin-top: var(--space-4xl);
}

.work-catalog--primary {
  margin-top: 0;
  padding-top: var(--space-3xl);
}

.work-catalog__title {
  margin: 0 0 var(--space-xl);
  font-size: clamp(2rem, 4vw, 3.75rem);
  letter-spacing: -0.045em;
  line-height: 1;
}

.section-indicator {
  position: fixed;
  z-index: var(--z-sticky);
  top: 50%;
  right: var(--space-xs);
  display: flex;
  width: var(--space-sm);
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-xs);
  transform: translateY(-50%);
}

.section-indicator button {
  display: flex;
  width: 1.5rem;
  height: 1.5rem;
  align-items: center;
  justify-content: flex-end;
  cursor: pointer;
  border: 0;
  padding: 0;
  background: transparent;
}

.section-indicator span {
  width: 0.875rem;
  height: 2px;
  background: var(--semantic-color-text-text-muted);
  opacity: 0.55;
  transform: scaleX(0.5714);
  transform-origin: right center;
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.section-indicator button.active span {
  background: var(--semantic-color-text-text-primary);
  opacity: 1;
  transform: scaleX(1);
}

.section-indicator button:not(.active):hover span,
.section-indicator button:not(.active):focus-visible span {
  opacity: 0.85;
  transform: scaleX(0.7143);
}

.section-indicator button:focus-visible {
  border-radius: var(--corner-radius-sm);
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: 1px;
}

.work-filters {
  margin-bottom: var(--space-xl);
}

.work-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-xl);
}

.work-content-enter-active,
.work-content-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.work-content-enter-from {
  opacity: 0;
  transform: translateY(0.5rem);
}

.work-content-leave-to {
  opacity: 0;
  transform: translateY(-0.35rem);
}

.work-card {
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--semantic-color-background-bg-surface) 88%, transparent);
  color: inherit;
  text-decoration: none;
  transition: transform 180ms ease, border-color 180ms ease;
}

.work-card:hover {
  transform: translateY(-4px);
  border-color: var(--semantic-color-text-text-accent);
}

.work-card:focus-visible,
button:focus-visible {
  outline: 3px solid var(--semantic-color-text-text-accent);
  outline-offset: 3px;
}

.work-card__media {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--semantic-color-background-bg-surface-hover);
}

.work-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work-card__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--semantic-color-text-text-accent) 34%, transparent), transparent 62%),
    var(--semantic-color-background-bg-surface-hover);
}

.work-card__placeholder span {
  opacity: 0.2;
  font-size: clamp(5rem, 14vw, 11rem);
  font-weight: var(--typography-font-weight-bold);
}

.work-card__status {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--semantic-color-background-bg-default) 82%, transparent);
  font-size: var(--font-size-body-small);
  text-transform: capitalize;
  backdrop-filter: blur(12px);
}

.work-card__body {
  padding: var(--space-xl);
}

.work-card__meta {
  display: flex;
  justify-content: space-between;
  color: var(--semantic-color-text-text-primary);
  font-size: var(--font-size-body-small);
}

.work-card h2 {
  margin: var(--space-sm) 0;
  font-size: var(--font-size-heading-h2);
}

.work-card p {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  line-height: var(--line-height-body);
}

.work-card ul {
  display: flex;
  flex-wrap: wrap;
  margin: var(--space-lg) 0;
  padding: 0;
  gap: var(--space-xs);
  list-style: none;
}

.work-card li {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  background: var(--semantic-color-background-bg-surface-hover);
  font-size: var(--font-size-body-small);
}

.work-card__link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--semantic-color-text-text-primary);
  font-weight: var(--typography-font-weight-bold);
}

.work-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-xl);
  gap: var(--space-lg);
}

.work-pagination p {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-small);
}

.work-pagination__actions {
  display: flex;
  gap: var(--space-sm);
}

.work-pagination__button {
  width: max-content;
}

.work-state {
  display: grid;
  min-height: 22rem;
  place-items: center;
  align-content: center;
  gap: var(--space-sm);
  text-align: center;
}

.work-state h2,
.work-state p {
  margin: 0;
}

.work-state p {
  max-width: 34rem;
  color: var(--semantic-color-text-text-secondary);
}

.work-state__retry {
  width: max-content;
  margin-top: var(--space-sm);
}

.work-card--loading {
  min-height: 26rem;
  padding-bottom: var(--space-xl);
}

.skeleton {
  border-radius: var(--radius-md);
  background: var(--semantic-color-background-bg-surface-hover);
  animation: pulse 1.2s ease-in-out infinite alternate;
}

.skeleton--media {
  aspect-ratio: 16 / 9;
  border-radius: 0;
}

.skeleton--line {
  width: calc(100% - var(--space-2xl));
  height: 1.1rem;
  margin: var(--space-xl) var(--space-xl) 0;
}

.skeleton--short {
  width: 48%;
  margin-top: var(--space-sm);
}

@keyframes pulse {
  to { opacity: 0.45; }
}

@media (max-width: 47.99rem) {
  .work-main { padding-block: var(--space-xl); }
  .featured-section__header {
    padding-block: var(--space-2xl) var(--space-lg);
  }
  .featured-card {
    width: min(78vw, 19rem);
  }
  .featured-card__copy {
    min-height: 15rem;
    padding: var(--space-lg) var(--space-xs) var(--space-xs);
  }
  .work-catalog { margin-top: var(--space-3xl); }
  .work-grid { grid-template-columns: 1fr; }
  .work-card__body { padding: var(--space-lg); }
  .work-pagination {
    align-items: stretch;
    flex-direction: column;
  }
  .work-pagination__actions,
  .work-pagination__button { width: 100%; }
  .section-indicator { right: var(--space-xxs); }
}

@media (prefers-reduced-motion: reduce) {
  .featured-rail { scroll-behavior: auto; }
  .featured-card,
  .work-card { transition: none; }
  .featured-content-enter-active,
  .featured-content-leave-active,
  .work-content-enter-active,
  .work-content-leave-active { transition: none; }
  .section-indicator span { transition: none; }
  .skeleton { animation: none; }
}
</style>
