<script setup lang="ts">
import { ArrowLeft, ExternalLink, RotateCcw } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { fetchWork, type WorkContentItem, type WorkDetail, type WorkLocale } from '../../../services/backend'
import { AppFooter } from '../../../shared/layout'
import { AppButton } from '../../../shared/ui'

const route = useRoute()
const { locale: appLocale } = useI18n()
const locale = ref<WorkLocale>(appLocale.value === 'th' ? 'th' : 'en')
const work = ref<WorkDetail>()
const loading = ref(true)
const error = ref('')
const activeSection = ref(0)
const workCache = new Map<string, WorkDetail>()
let sectionAnimationFrame: number | undefined

const copy = computed(() =>
  locale.value === 'th'
    ? {
        back: 'กลับไปหน้าผลงาน',
        overview: 'ภาพรวม',
        feasibility: 'แนวทางและความเป็นไปได้',
        targetUsers: 'ผู้ใช้งานเป้าหมาย',
        roles: 'บทบาท',
        stack: 'เทคโนโลยี',
        features: 'สิ่งที่สร้าง',
        challenges: 'ความท้าทาย',
        learnings: 'สิ่งที่ได้เรียนรู้',
        architecture: 'สถาปัตยกรรม',
        links: 'ดูโปรเจกต์',
        retry: 'ลองอีกครั้ง',
        category: 'หมวดหมู่',
        status: 'สถานะ',
        timeline: 'ระยะเวลา',
        present: 'ปัจจุบัน',
      }
    : {
        back: 'Back to all work',
        overview: 'Overview',
        feasibility: 'Approach & feasibility',
        targetUsers: 'Target users',
        roles: 'Roles',
        stack: 'Technology stack',
        features: 'What I built',
        challenges: 'Challenges',
        learnings: 'What I learned',
        architecture: 'Architecture',
        links: 'Explore the project',
        retry: 'Try again',
        category: 'Category',
        status: 'Status',
        timeline: 'Timeline',
        present: 'Present',
      },
)

const slug = computed(() => String(route.params.slug ?? ''))

const detailSections = computed(() => {
  if (!work.value) return []

  const project = work.value
  return [
    { id: 'project-hero', label: project.name, visible: true },
    { id: 'project-overview', label: copy.value.overview, visible: true },
    { id: 'project-context', label: copy.value.feasibility, visible: true },
    ...contentSections(project).map((section) => ({
      id: `project-${section.key}`,
      label: section.title,
      visible: true,
    })),
    { id: 'project-gallery', label: 'Gallery', visible: project.gallery.length > 1 },
    { id: 'project-architecture', label: copy.value.architecture, visible: Boolean(project.architecture) },
    { id: 'project-links', label: copy.value.links, visible: project.links.length > 0 },
  ].filter((section) => section.visible)
})

function workCacheKey(value: WorkLocale) {
  return `${slug.value}:${value}`
}

async function getWork(value: WorkLocale) {
  const cacheKey = workCacheKey(value)
  const cachedWork = workCache.get(cacheKey)
  if (cachedWork) return cachedWork

  const nextWork = await fetchWork(slug.value, value)
  workCache.set(cacheKey, nextWork)
  return nextWork
}

async function loadWork() {
  loading.value = true
  error.value = ''
  try {
    work.value = await getWork(locale.value)
    void getWork(locale.value === 'en' ? 'th' : 'en').catch(() => undefined)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load this project.'
  } finally {
    loading.value = false
  }
}

async function applyRouteLocale(value: WorkLocale) {
  if (value === locale.value) return
  const scrollPosition = { left: window.scrollX, top: window.scrollY }
  error.value = ''
  try {
    work.value = await getWork(value)
    locale.value = value
    await nextTick()
    window.scrollTo(scrollPosition.left, scrollPosition.top)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load this project.'
  }
}

function contentSections(project: WorkDetail) {
  return [
    { key: 'features', title: copy.value.features, items: project.features },
    { key: 'challenges', title: copy.value.challenges, items: project.challenges },
    { key: 'learnings', title: copy.value.learnings, items: project.learnings },
  ].filter((section): section is { key: string; title: string; items: WorkContentItem[] } =>
    section.items.length > 0,
  )
}

function formatStatus(status: WorkDetail['status']) {
  return status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatWorkDate(value: string) {
  return new Intl.DateTimeFormat(locale.value === 'th' ? 'th-TH' : 'en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function updateActiveSection() {
  sectionAnimationFrame = undefined
  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY

  detailSections.value.forEach((section, index) => {
    const element = document.getElementById(section.id)
    if (!element) return

    const distance = Math.abs(element.getBoundingClientRect().top - 64)
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

watch(slug, () => void loadWork())
watch(
  appLocale,
  (value) => void applyRouteLocale(value === 'th' ? 'th' : 'en'),
)
watch(detailSections, () => nextTick(requestSectionUpdate))
onMounted(() => {
  document.documentElement.classList.add('work-section-scroll')
  window.addEventListener('scroll', requestSectionUpdate, { passive: true })
  window.addEventListener('resize', requestSectionUpdate)
  void loadWork()
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('work-section-scroll')
  window.removeEventListener('scroll', requestSectionUpdate)
  window.removeEventListener('resize', requestSectionUpdate)
  if (sectionAnimationFrame !== undefined) window.cancelAnimationFrame(sectionAnimationFrame)
})
</script>

<template>
  <div class="work-detail-page">
    <main class="detail-main page-container">
      <div class="detail-toolbar">
        <RouterLink
          class="back-link"
          :to="{ name: 'work', query: locale === 'th' ? { locale: 'th' } : {} }"
        >
          <ArrowLeft :size="17" aria-hidden="true" />
          {{ copy.back }}
        </RouterLink>
      </div>

      <div v-if="loading" class="detail-loading" aria-label="Loading project" aria-busy="true">
        <div class="skeleton skeleton--eyebrow" />
        <div class="skeleton skeleton--title" />
        <div class="skeleton skeleton--summary" />
        <div class="skeleton skeleton--hero" />
      </div>

      <section v-else-if="error" class="detail-state">
        <h1>Could not load this project</h1>
        <p>{{ error }}</p>
        <button type="button" @click="loadWork">
          <RotateCcw :size="16" aria-hidden="true" />
          {{ copy.retry }}
        </button>
      </section>

      <template v-else-if="work">
        <header id="project-hero" class="detail-hero">
          <h1>{{ work.name }}</h1>
          <dl class="detail-hero__facts">
            <div class="detail-hero__fact">
              <dt>{{ copy.category }}</dt>
              <dd>{{ work.category.name }}</dd>
            </div>
            <div class="detail-hero__fact detail-hero__fact--status">
              <dt>{{ copy.status }}</dt>
              <dd>
                <span class="status-label" :data-status="work.status">
                  {{ formatStatus(work.status) }}
                </span>
              </dd>
            </div>
            <div class="detail-hero__fact">
              <dt>{{ copy.timeline }}</dt>
              <dd>
                <time v-if="work.startedOn" :datetime="work.startedOn">
                  {{ formatWorkDate(work.startedOn) }}
                </time>
                <span class="timeline-separator" aria-hidden="true">—</span>
                <time v-if="work.completedOn" :datetime="work.completedOn">
                  {{ formatWorkDate(work.completedOn) }}
                </time>
                <span v-else-if="work.status === 'ACTIVE'">{{ copy.present }}</span>
                <span v-else>—</span>
              </dd>
            </div>
          </dl>
        </header>

        <div class="detail-cover">
          <img
            v-if="work.gallery[0]"
            :src="work.gallery[0].url"
            :alt="work.gallery[0].altText ?? ''"
          />
          <div v-else class="detail-cover__placeholder" aria-hidden="true">
            <span>{{ work.name }}</span>
          </div>
        </div>

        <section id="project-overview" class="detail-introduction">
          <article>
            <p class="section-label">{{ copy.overview }}</p>
            <p>{{ work.overview }}</p>
          </article>
          <aside>
            <div>
              <p class="section-label">{{ copy.roles }}</p>
              <ul>
                <li v-for="position in work.positions" :key="position.code">
                  {{ position.name }}
                </li>
              </ul>
            </div>
            <div>
              <p class="section-label">{{ copy.stack }}</p>
              <ul class="technology-list">
                <li v-for="technology in work.technologies" :key="technology.slug">
                  <a
                    v-if="technology.officialUrl"
                    :href="technology.officialUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ technology.name }}
                  </a>
                  <span v-else>{{ technology.name }}</span>
                </li>
              </ul>
            </div>
          </aside>
        </section>

        <section id="project-context" class="detail-context">
          <article>
            <p class="section-label">{{ copy.feasibility }}</p>
            <p>{{ work.feasibility }}</p>
          </article>
          <article>
            <p class="section-label">{{ copy.targetUsers }}</p>
            <p>{{ work.targetUsers }}</p>
          </article>
        </section>

        <section
          v-for="(section, sectionIndex) in contentSections(work)"
          :key="section.key"
          :id="`project-${section.key}`"
          class="detail-content"
        >
          <header>
            <span>0{{ sectionIndex + 1 }}</span>
            <h2>{{ section.title }}</h2>
          </header>
          <div class="detail-content__grid">
            <article v-for="item in section.items" :key="item.title">
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
            </article>
          </div>
        </section>

        <section v-if="work.gallery.length > 1" id="project-gallery" class="detail-gallery">
          <img
            v-for="image in work.gallery.slice(1)"
            :key="image.url"
            :src="image.url"
            :alt="image.altText ?? ''"
            loading="lazy"
          />
        </section>

        <section v-if="work.architecture" id="project-architecture" class="detail-architecture">
          <p class="section-label">{{ copy.architecture }}</p>
          <img
            :src="work.architecture.url"
            :alt="work.architecture.altText ?? copy.architecture"
            loading="lazy"
          />
        </section>

        <section v-if="work.links.length" id="project-links" class="detail-links">
          <p class="section-label">{{ copy.links }}</p>
          <div>
            <AppButton
              v-for="link in work.links"
              :key="link.url"
              :href="link.url"
              variant="primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ link.label }}
              <ExternalLink :size="17" aria-hidden="true" />
            </AppButton>
          </div>
        </section>
      </template>
    </main>

    <nav v-if="detailSections.length" class="section-indicator" aria-label="Project sections">
      <button
        v-for="(section, index) in detailSections"
        :key="section.id"
        type="button"
        :class="{ active: activeSection === index }"
        :aria-label="`Go to ${section.label}`"
        :aria-current="activeSection === index ? 'step' : undefined"
        @click="scrollToSection(section.id)"
      >
        <span aria-hidden="true" />
      </button>
    </nav>

    <AppFooter />
  </div>
</template>

<style scoped>
.work-detail-page {
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
}

.detail-main {
  width: 100%;
  flex: 1;
  padding-block: var(--space-2xl) var(--space-4xl);
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
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.section-indicator span {
  width: 0.5rem;
  height: 2px;
  background: var(--semantic-color-text-text-muted);
  opacity: 0.55;
  transition:
    width 180ms ease,
    background-color 180ms ease,
    opacity 180ms ease;
}

.section-indicator button:hover span,
.section-indicator button:focus-visible span,
.section-indicator button.active span {
  width: 0.875rem;
  background: var(--semantic-color-text-text-primary);
  opacity: 1;
}

.detail-toolbar,
.back-link,
.detail-state button {
  display: flex;
  align-items: center;
}

.detail-toolbar {
  justify-content: space-between;
  gap: var(--space-lg);
}

.back-link {
  gap: var(--space-xs);
  color: var(--semantic-color-text-text-secondary);
  text-decoration: none;
}

.back-link:hover { color: var(--semantic-color-text-text-primary); }

.detail-hero {
  padding-block: var(--space-4xl) var(--space-3xl);
}

.detail-hero h1 {
  margin: 0;
  font-size: clamp(3.25rem, 9vw, 7.75rem);
  line-height: 0.92;
  letter-spacing: -0.065em;
}

.detail-hero__facts {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1.4fr);
  max-width: 54rem;
  margin: var(--space-2xl) 0 0;
  padding: var(--space-lg) 0 0;
  border-top: 1px solid var(--semantic-color-border-border-default);
  gap: var(--space-lg);
}

.detail-hero__fact {
  min-width: 0;
}

.detail-hero__fact dt {
  margin-bottom: var(--space-xs);
  color: var(--semantic-color-text-text-tertiary);
  font-size: var(--font-size-body-small);
  font-weight: var(--typography-font-weight-medium);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.detail-hero__fact dd {
  margin: 0;
  color: var(--semantic-color-text-text-primary);
  font-size: var(--font-size-body-large);
  font-weight: var(--typography-font-weight-semibold);
}

.status-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--semantic-color-text-text-primary);
  font-size: inherit;
}

.status-label::before {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background: var(--semantic-color-text-text-secondary);
  content: '';
}

.status-label[data-status='COMPLETED']::before {
  background: var(--semantic-color-success-success-text);
}

.timeline-separator {
  margin-inline: var(--space-sm);
  color: var(--semantic-color-text-text-tertiary);
}

.detail-cover {
  aspect-ratio: 16 / 8.5;
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--radius-lg);
  background: var(--semantic-color-background-bg-surface-hover);
}

.detail-cover img,
.detail-gallery img,
.detail-architecture img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-cover__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  background:
    radial-gradient(circle at 72% 24%, color-mix(in srgb, var(--semantic-color-text-text-accent) 30%, transparent), transparent 32%),
    linear-gradient(145deg, var(--semantic-color-background-bg-surface-hover), var(--semantic-color-background-bg-surface));
}

.detail-cover__placeholder span {
  max-width: 80%;
  opacity: 0.16;
  font-size: clamp(3rem, 11vw, 9rem);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: -0.06em;
  text-align: center;
}

.detail-introduction,
.detail-context {
  display: grid;
  gap: var(--space-3xl);
  padding-block: var(--space-4xl);
}

.detail-introduction { grid-template-columns: minmax(0, 1.8fr) minmax(16rem, 0.8fr); }
.detail-context { grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--semantic-color-border-border-default); }

.detail-introduction article > p:last-child,
.detail-context article > p:last-child {
  margin: 0;
  font-size: var(--font-size-body-large);
  line-height: 1.75;
}

.detail-introduction aside {
  display: grid;
  align-content: start;
  gap: var(--space-xl);
}

.section-label {
  margin: 0 0 var(--space-md);
  color: var(--semantic-color-text-text-primary);
  font-size: var(--font-size-body-small);
  font-weight: var(--typography-font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.detail-introduction ul {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  gap: var(--space-xs);
  list-style: none;
}

.detail-introduction li {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  background: var(--semantic-color-background-bg-surface-hover);
  font-size: var(--font-size-body-small);
}

.technology-list a {
  color: inherit;
  text-decoration: none;
}

.technology-list a:hover { color: var(--semantic-color-text-text-accent); }

.detail-content {
  padding-block: var(--space-3xl);
  border-top: 1px solid var(--semantic-color-border-border-default);
}

.detail-content > header {
  display: grid;
  grid-template-columns: 3rem 1fr;
  align-items: baseline;
  gap: var(--space-md);
  margin-bottom: var(--space-2xl);
}

.detail-content > header span {
  color: var(--semantic-color-text-text-secondary);
  font-family: var(--font-family-mono);
}

.detail-content h2 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 4rem);
  letter-spacing: -0.04em;
}

.detail-content__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-xl);
  padding-left: calc(3rem + var(--space-md));
}

.detail-content__grid article {
  padding: var(--space-xl);
  border-radius: var(--radius-lg);
  background: var(--semantic-color-background-bg-surface);
}

.detail-content h3 { margin: 0 0 var(--space-sm); }
.detail-content p { margin: 0; color: var(--semantic-color-text-text-secondary); line-height: var(--line-height-body); }

.detail-gallery {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-lg);
  padding-block: var(--space-3xl);
}

.detail-gallery img,
.detail-architecture img {
  border-radius: var(--radius-lg);
}

.detail-gallery img { aspect-ratio: 4 / 3; }

.detail-architecture { padding-block: var(--space-3xl); }
.detail-architecture img { height: auto; border: 1px solid var(--semantic-color-border-border-default); }

.detail-links {
  padding-block: var(--space-3xl);
  border-top: 1px solid var(--semantic-color-border-border-default);
}

.detail-links > div { display: flex; flex-wrap: wrap; gap: var(--space-sm); }

.detail-links .app-button { width: auto; }

.detail-links :deep(.app-button__label) {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

.detail-state button {
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--radius-full);
  background: var(--semantic-color-background-bg-surface);
  color: inherit;
  font-weight: var(--typography-font-weight-bold);
  text-decoration: none;
}

.detail-state {
  display: grid;
  min-height: 60dvh;
  place-items: center;
  align-content: center;
  text-align: center;
}

.detail-state h1,
.detail-state p { margin: 0 0 var(--space-md); }
.detail-state p { color: var(--semantic-color-text-text-secondary); }
.detail-state button { cursor: pointer; font: inherit; }

.detail-loading { padding-block: var(--space-4xl); }
.skeleton { border-radius: var(--radius-md); background: var(--semantic-color-background-bg-surface-hover); animation: pulse 1.2s ease-in-out infinite alternate; }
.skeleton--eyebrow { width: 12rem; height: 1rem; }
.skeleton--title { width: min(80%, 48rem); height: 7rem; margin-top: var(--space-lg); }
.skeleton--summary { width: min(65%, 38rem); height: 2rem; margin-top: var(--space-lg); }
.skeleton--hero { aspect-ratio: 16 / 8.5; margin-top: var(--space-3xl); }

@keyframes pulse { to { opacity: 0.45; } }

button:focus-visible,
a:focus-visible {
  outline: 3px solid var(--semantic-color-text-text-accent);
  outline-offset: 3px;
}

@media (max-width: 47.99rem) {
  .detail-main { padding-block: var(--space-xl) var(--space-3xl); }
  .detail-hero { padding-block: var(--space-3xl) var(--space-2xl); }
  .detail-hero__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .detail-hero__fact:last-child { grid-column: 1 / -1; }
  .section-indicator { right: var(--space-xxs); }
  .detail-cover { aspect-ratio: 4 / 3; }
  .detail-introduction,
  .detail-context,
  .detail-content__grid,
  .detail-gallery { grid-template-columns: 1fr; }
  .detail-introduction,
  .detail-context { gap: var(--space-2xl); padding-block: var(--space-3xl); }
  .detail-content__grid { padding-left: 0; }
  .skeleton--title { height: 4.5rem; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .section-indicator span { transition: none; }
}
</style>
