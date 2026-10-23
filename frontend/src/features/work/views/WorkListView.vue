<script setup lang="ts">
import { BriefcaseBusiness, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { type WorkLocale, type WorkSummary } from '@/features/work/api'
import { useWorkListing } from '../composables/useWorkListing'
import { useGalleryMotion } from '../composables/useGalleryMotion'
import { AppFooter } from '../../../shared/layout'
import { AppButton, AppSectionIndicator, AppTextLink, AppToast } from '../../../shared/ui'
import GithubActivitySection from '../components/GithubActivitySection.vue'
import WorkCategoryFilter from '../components/WorkCategoryFilter.vue'

const { locale: appLocale } = useI18n()
const featuredCategory = '__featured'
const locale = ref<WorkLocale>(appLocale.value === 'th' ? 'th' : 'en')
const selectedCategory = ref('all')
const listingCategory = computed(() =>
  selectedCategory.value === featuredCategory ? 'all' : selectedCategory.value,
)
const workPageSize = ref(6)
const visibleWorkCount = ref(6)
const retrying = ref(false)
const toastOpen = ref(false)
const galleryElement = ref<HTMLElement>()
const galleryMotion = useGalleryMotion(galleryElement)
const canScrollPrevious = ref(false)
const canScrollNext = ref(false)
const listing = useWorkListing(locale, listingCategory, workPageSize)
const { works, overview, total, loading, loadingMore, error } = listing
const copy = computed(() =>
  locale.value === 'th'
    ? {
        workTitle: 'ผลงานทั้งหมด',
        all: 'ทั้งหมด',
        featured: 'แนะนำ',
        loadMore: 'แสดงเพิ่มเติม',
        showLess: 'แสดงน้อยลง',
        empty: 'ยังไม่มีผลงานในหมวดหมู่นี้',
        retry: 'ลองอีกครั้ง',
        retrying: 'กำลังโหลด…',
        loadFailed: 'โหลดโปรเจกต์ไม่สำเร็จ กรุณาลองอีกครั้ง',
        view: 'ดูโปรเจกต์',
        gallery: 'รายการผลงาน',
        previous: 'เลื่อนไปผลงานก่อนหน้า',
        next: 'เลื่อนไปผลงานถัดไป',
      }
    : {
        workTitle: 'All work',
        all: 'All work',
        featured: 'Featured',
        loadMore: 'Load more',
        showLess: 'Show less',
        empty: 'There are no projects in this category yet.',
        retry: 'Try again',
        retrying: 'Loading…',
        loadFailed: 'Could not load projects. Please try again.',
        view: 'View project',
        gallery: 'Portfolio projects',
        previous: 'Previous projects',
        next: 'Next projects',
      },
)

const categories = computed(() => [
  { code: featuredCategory, name: copy.value.featured },
  ...overview.value.categories,
])
const filteredWorks = computed(() =>
  selectedCategory.value === featuredCategory ? overview.value.featured : works.value,
)
const displayTotal = computed(() =>
  selectedCategory.value === featuredCategory ? overview.value.featured.length : total.value,
)

const visibleFilteredWorks = computed(() => filteredWorks.value.slice(0, visibleWorkCount.value))

const workSectionIds = ['all-work', 'github-activity']
const workSections = workSectionIds.map((id) => ({ id, label: id.replaceAll('-', ' ') }))

async function loadWorks(force = false) {
  if (!(await listing.load(force))) return
  if (
    !error.value &&
    selectedCategory.value !== 'all' &&
    !categories.value.some((item) => item.code === selectedCategory.value)
  ) {
    selectedCategory.value = 'all'
    if (!(await listing.load())) return
  }
  if (error.value) toastOpen.value = true
  if (selectedCategory.value !== featuredCategory) {
    await listing.ensureVisible(visibleWorkCount.value)
  }
}

async function retryLoadWorks() {
  if (retrying.value) return

  retrying.value = true
  try {
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await Promise.all([
      loadWorks(true),
      new Promise<void>((resolve) => window.setTimeout(resolve, 600)),
    ])
  } finally {
    retrying.value = false
  }
}

function formatStatus(status: WorkSummary['status']) {
  return status.toLowerCase().replaceAll('_', ' ')
}

function updateGalleryScroll() {
  const gallery = galleryElement.value
  canScrollPrevious.value = Boolean(gallery && gallery.scrollLeft > 1)
  canScrollNext.value = Boolean(
    gallery && gallery.scrollLeft + gallery.clientWidth < gallery.scrollWidth - 1,
  )
}

function scrollGallery(direction: -1 | 1) {
  const gallery = galleryElement.value
  const card = gallery?.querySelector<HTMLElement>('.work-card')
  if (!gallery || !card) return

  const style = getComputedStyle(gallery)
  const gap = Number.parseFloat(style.columnGap) || 0
  const startPadding = Number.parseFloat(style.paddingInlineStart) || 0
  const endPadding = Number.parseFloat(style.paddingInlineEnd) || 0
  const step = card.getBoundingClientRect().width + gap
  const cardsPerPage = Math.max(
    1,
    Math.floor((gallery.clientWidth - startPadding - endPadding + gap) / step),
  )
  galleryMotion.scrollTo(
    (Math.round(galleryMotion.destination() / step) + direction * cardsPerPage) * step,
  )
}

function selectCategory(category: string) {
  if (selectedCategory.value === category) return
  selectedCategory.value = category
  visibleWorkCount.value = workPageSize.value
  if (category === featuredCategory) return
  void loadWorks()
}

function updateWorkPageSize() {
  galleryMotion.cancel()
  const previousPageSize = workPageSize.value
  const nextPageSize = window.matchMedia('(max-width: 47.99rem)').matches ? 4 : 6
  workPageSize.value = nextPageSize

  if (visibleWorkCount.value <= previousPageSize) visibleWorkCount.value = nextPageSize
  updateGalleryScroll()
}

async function loadMoreWorks() {
  const target = Math.min(displayTotal.value, visibleWorkCount.value + workPageSize.value)
  if (selectedCategory.value === featuredCategory) {
    visibleWorkCount.value = target
    return
  }
  if (!(await listing.ensureVisible(target))) return
  visibleWorkCount.value = Math.min(target, works.value.length)
  if (listing.moreError.value) toastOpen.value = true
}

function showFewerWorks() {
  visibleWorkCount.value = workPageSize.value
  document.getElementById('all-work')?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
}

watch(appLocale, async (value) => {
  const nextLocale: WorkLocale = value === 'th' ? 'th' : 'en'
  if (nextLocale === locale.value) return
  locale.value = nextLocale
  await loadWorks()
})
watch(workPageSize, async () => {
  if (selectedCategory.value !== featuredCategory) {
    await listing.ensureVisible(visibleWorkCount.value)
  }
})
watch(
  [galleryElement, visibleFilteredWorks],
  async () => {
    await nextTick()
    updateGalleryScroll()
  },
  { flush: 'post' },
)
onMounted(() => {
  updateWorkPageSize()
  void loadWorks()
  document.documentElement.classList.add('work-section-scroll')
  window.addEventListener('resize', updateWorkPageSize)
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('work-section-scroll')
  window.removeEventListener('resize', updateWorkPageSize)
})
</script>

<template>
  <div class="work-page">
    <main class="work-main">
      <div id="all-work" class="work-catalog work-catalog--primary">
        <div class="page-container">
          <h1 class="work-catalog__title">{{ copy.workTitle }}</h1>
          <WorkCategoryFilter
            v-if="!loading && !error"
            class="work-filters"
            :model-value="selectedCategory"
            :all-label="copy.all"
            :options="categories"
            label="Project categories"
            @update:model-value="selectCategory"
          />
        </div>

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
          <div :key="`${selectedCategory}:${locale}`" class="work-gallery">
            <section
              id="work-gallery"
              ref="galleryElement"
              class="work-grid"
              :aria-label="copy.gallery"
              tabindex="0"
              @scroll.passive="updateGalleryScroll"
              @wheel="galleryMotion.onWheel"
              @pointerdown="galleryMotion.cancel"
              @touchstart.passive="galleryMotion.cancel"
              @keydown.left.self.prevent="scrollGallery(-1)"
              @keydown.right.self.prevent="scrollGallery(1)"
            >
              <article v-for="work in visibleFilteredWorks" :key="work.slug" class="work-card">
                <RouterLink
                  class="work-card__visual-link"
                  :to="{
                    name: 'work-detail',
                    params: { slug: work.slug },
                    query: locale === 'th' ? { locale: 'th' } : {},
                  }"
                  :aria-label="`${copy.view}: ${work.name}`"
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
                      <span>{{ work.name }}</span>
                    </div>
                    <span class="work-card__status">{{ formatStatus(work.status) }}</span>
                  </div>
                </RouterLink>

                <div class="work-card__body">
                  <div class="work-card__meta">
                    <span>{{ work.category.name }}</span>
                  </div>
                  <h2>{{ work.name }}</h2>
                  <p>{{ work.shortDescription }}</p>
                  <ul
                    v-if="work.technologies.length"
                    class="work-card__tech-stack"
                    aria-label="Technologies"
                  >
                    <li v-for="technology in work.technologies.slice(0, 3)" :key="technology.slug">
                      {{ technology.name }}
                    </li>
                  </ul>
                  <AppTextLink
                    class="work-card__link"
                    :to="{
                      name: 'work-detail',
                      params: { slug: work.slug },
                      query: locale === 'th' ? { locale: 'th' } : {},
                    }"
                  >
                    {{ copy.view }}
                  </AppTextLink>
                </div>
              </article>
            </section>
            <nav
              v-if="canScrollPrevious || canScrollNext"
              class="work-gallery-controls"
              :aria-label="copy.gallery"
            >
              <AppButton
                class="work-gallery-controls__button"
                variant="secondary"
                :disabled="!canScrollPrevious"
                :aria-label="copy.previous"
                aria-controls="work-gallery"
                @click="scrollGallery(-1)"
              >
                <ChevronLeft :size="24" aria-hidden="true" />
              </AppButton>
              <AppButton
                class="work-gallery-controls__button"
                variant="secondary"
                :disabled="!canScrollNext"
                :aria-label="copy.next"
                aria-controls="work-gallery"
                @click="scrollGallery(1)"
              >
                <ChevronRight :size="24" aria-hidden="true" />
              </AppButton>
            </nav>
          </div>
        </Transition>

        <div
          v-if="
            !loading &&
            !error &&
            filteredWorks.length &&
            (visibleWorkCount < displayTotal || visibleWorkCount > workPageSize)
          "
          class="work-pagination page-container"
        >
          <div class="work-pagination__actions">
            <AppButton
              v-if="visibleWorkCount < displayTotal"
              :disabled="loadingMore"
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

    <AppSectionIndicator :sections="workSections" aria-label="Portfolio page sections" />

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
    radial-gradient(
      circle at 82% 6%,
      color-mix(in srgb, var(--semantic-color-text-text-accent) 10%, transparent),
      transparent 28rem
    ),
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

.work-filters {
  margin-bottom: var(--space-xl);
}

.work-gallery,
.work-grid {
  --work-gallery-gutter: max(
    var(--layout-page-gutter),
    calc((100% - var(--layout-content-max-width)) / 2 + var(--layout-page-gutter))
  );
  --work-card-width: min(
    82vw,
    calc(
      (var(--layout-content-max-width) - var(--layout-page-gutter) * 2 - var(--space-lg) * 2) / 3
    )
  );
}

.work-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: var(--work-card-width);
  grid-template-rows: repeat(6, auto);
  column-gap: var(--space-lg);
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  padding: var(--space-sm) var(--work-gallery-gutter) var(--space-lg);
  scroll-padding-inline: var(--work-gallery-gutter);
  scrollbar-width: none;
}

.work-grid::-webkit-scrollbar {
  display: none;
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
  display: grid;
  width: 100%;
  min-width: 0;
  grid-row: span 6;
  grid-template-rows: subgrid;
  justify-items: center;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: center;
}

.work-card__visual-link {
  position: relative;
  display: block;
  width: 100%;
  color: inherit;
  text-decoration: none;
}

.work-card__visual-link:focus-visible,
.work-card__link:focus-visible,
.work-grid:focus-visible,
button:focus-visible {
  outline: 3px solid var(--semantic-color-text-text-accent);
  outline-offset: 3px;
}

.work-grid:focus-visible {
  outline-offset: -3px;
}

.work-card__media {
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

.work-card__visual-link:hover .work-card__media {
  box-shadow: var(--effect-shadow-lg);
  transform: translateY(-6px);
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
  overflow: hidden;
  background:
    radial-gradient(
      circle at 25% 20%,
      color-mix(in srgb, var(--semantic-color-text-text-accent) 52%, transparent),
      transparent 36%
    ),
    radial-gradient(
      circle at 78% 72%,
      color-mix(in srgb, var(--semantic-color-text-text-accent) 24%, transparent),
      transparent 40%
    ),
    var(--semantic-color-background-bg-surface-hover);
}

.work-card__placeholder span {
  max-width: 84%;
  overflow: hidden;
  opacity: 0.16;
  font-size: clamp(2rem, 3.6vw, 3.5rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.06em;
  text-align: center;
  white-space: nowrap;
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
  display: contents;
}

.work-card__meta {
  display: flex;
  grid-row: 2;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin: var(--space-lg) var(--space-sm) 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-small);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.work-card h2 {
  grid-row: 3;
  margin: var(--space-sm) var(--space-sm) var(--space-xs);
  font-size: var(--font-size-heading-h1);
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.work-card p {
  grid-row: 4;
  margin: 0 var(--space-sm);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-medium);
  line-height: var(--line-height-body);
}

.work-card__tech-stack {
  display: flex;
  grid-row: 5;
  flex-wrap: wrap;
  justify-content: center;
  margin: var(--space-md) 0 var(--space-lg);
  padding: 0;
  gap: var(--space-xs);
  list-style: none;
}

.work-card__tech-stack li {
  padding: var(--space-xxs) var(--space-sm);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--radius-full);
  background: var(--semantic-color-background-bg-surface-hover);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-small);
  font-weight: var(--typography-font-weight-medium);
  line-height: var(--line-height-label);
}

.work-card__link {
  grid-row: 6;
  align-self: end;
  margin-bottom: var(--space-sm);
}

.work-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: var(--space-xl);
  gap: var(--space-lg);
}

.work-pagination__actions {
  display: flex;
  gap: var(--space-sm);
}

.work-gallery-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
  padding-inline: var(--work-gallery-gutter);
}

.work-gallery-controls__button {
  width: calc(var(--icon-size-24) + var(--space-lg));
  height: calc(var(--icon-size-24) + var(--space-lg));
  padding: 0;
  border-radius: var(--radius-full);
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
  display: flex;
  flex-direction: column;
  min-height: 28rem;
  padding: var(--space-sm);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--semantic-color-background-bg-surface);
}

.skeleton {
  border-radius: var(--radius-md);
  background: var(--semantic-color-background-bg-surface-hover);
  animation: pulse 1.2s ease-in-out infinite alternate;
}

.skeleton--media {
  width: 100%;
  aspect-ratio: 4 / 3;
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
  to {
    opacity: 0.45;
  }
}

@media (max-width: 47.99rem) {
  .work-main {
    padding-block: var(--space-xl);
  }
  .work-catalog {
    margin-top: var(--space-3xl);
  }
  .work-catalog--primary {
    margin-top: 0;
  }
  .work-pagination {
    align-items: stretch;
    flex-direction: column;
  }
  .work-pagination__button {
    width: 100%;
  }
  .work-pagination__actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .section-indicator {
    right: var(--space-xxs);
  }
}

@media (prefers-reduced-motion: reduce) {
  .work-card__media {
    transition: none;
  }
  .work-content-enter-active,
  .work-content-leave-active {
    transition: none;
  }
  .section-indicator span {
    transition: none;
  }
  .skeleton {
    animation: none;
  }
}
</style>
