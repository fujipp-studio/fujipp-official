<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { AppFooter } from '@/shared/layout'
import { AppButton } from '@/shared/ui'

const { t, locale } = useI18n()
const sections = [
  { key: 'scope', paragraphs: ['body', 'detail'] },
  { key: 'data', paragraphs: [] },
  { key: 'use', paragraphs: ['body', 'detail'] },
  { key: 'sharing', paragraphs: ['body', 'detail'] },
  { key: 'storage', paragraphs: ['body', 'detail'] },
  { key: 'retention', paragraphs: ['body', 'detail'] },
  { key: 'security', paragraphs: ['body', 'detail'] },
  { key: 'rights', paragraphs: ['body', 'detail'] },
  { key: 'changes', paragraphs: ['body'] },
  { key: 'contact', paragraphs: ['body', 'detail'] },
] as const
const dataCategories = ['account', 'payment', 'bot', 'technical'] as const
const updatedDate = computed(() =>
  new Intl.DateTimeFormat(locale.value === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date('2026-10-20T00:00:00Z')),
)
</script>

<template>
  <div class="min-h-screen bg-bg-default text-text-primary">
    <main class="page-container pb-3xl pt-28 desktop:pt-36">
      <header class="border-b border-border-subtle pb-2xl desktop:pb-3xl">
        <p class="text-xs font-semibold tracking-widest text-text-muted">
          {{ t('privacy.eyebrow') }}
        </p>
        <h1
          class="mt-lg text-4xl font-bold leading-tight tracking-tight tablet:text-5xl desktop:text-7xl"
        >
          {{ t('privacy.title') }}
        </h1>
        <p class="mt-lg max-w-reading text-lg leading-relaxed text-text-secondary tablet:text-xl">
          {{ t('privacy.description') }}
        </p>
        <div class="mt-xl flex flex-wrap items-center gap-md text-sm">
          <time datetime="2026-10-20" class="text-text-muted">{{
            t('privacy.updated', { date: updatedDate })
          }}</time>
          <a
            href="#privacy-contact"
            class="inline-flex items-center gap-xs font-medium underline underline-offset-4"
          >
            {{ t('privacy.contact') }}<ArrowUpRight :size="16" aria-hidden="true" />
          </a>
        </div>
      </header>

      <div
        class="mt-2xl grid items-start gap-2xl desktop:mt-3xl desktop:grid-cols-12 desktop:gap-3xl"
      >
        <aside
          class="rounded-xl border border-border-subtle bg-bg-surface p-lg desktop:sticky desktop:top-28 desktop:col-span-3"
        >
          <nav :aria-label="t('privacy.contents')">
            <h2 class="text-xs font-semibold tracking-wide text-text-muted">
              {{ t('privacy.contents') }}
            </h2>
            <ol class="mt-md grid gap-sm tablet:grid-cols-2 desktop:grid-cols-1">
              <li v-for="(section, index) in sections" :key="section.key">
                <a
                  :href="`#privacy-${section.key}`"
                  class="flex items-baseline gap-sm text-sm text-text-secondary hover:text-text-primary"
                >
                  <span class="shrink-0 font-mono text-xs text-text-muted" aria-hidden="true">{{
                    String(index + 1).padStart(2, '0')
                  }}</span>
                  <span>{{ t(`privacy.sections.${section.key}.title`) }}</span>
                </a>
              </li>
            </ol>
          </nav>
        </aside>

        <article class="min-w-0 max-w-reading space-y-2xl desktop:col-span-9 desktop:space-y-3xl">
          <section
            v-for="(section, index) in sections"
            :id="`privacy-${section.key}`"
            :key="section.key"
            :aria-labelledby="`privacy-${section.key}-title`"
            class="privacy-section border-b border-border-subtle pb-2xl last:border-0 desktop:pb-3xl"
          >
            <div class="mb-lg flex items-baseline gap-md">
              <span class="shrink-0 font-mono text-sm text-text-muted" aria-hidden="true">{{
                String(index + 1).padStart(2, '0')
              }}</span>
              <h2
                :id="`privacy-${section.key}-title`"
                class="text-xl font-semibold tracking-tight tablet:text-2xl"
              >
                {{ t(`privacy.sections.${section.key}.title`) }}
              </h2>
            </div>
            <div class="space-y-md text-base leading-relaxed text-text-secondary">
              <p v-for="paragraph in section.paragraphs" :key="paragraph">
                {{ t(`privacy.sections.${section.key}.${paragraph}`) }}
              </p>
              <dl v-if="section.key === 'data'" class="grid gap-md tablet:grid-cols-2">
                <div
                  v-for="category in dataCategories"
                  :key="category"
                  class="rounded-xl border border-border-subtle bg-bg-surface p-lg"
                >
                  <dt class="font-semibold text-text-primary">
                    {{ t(`privacy.sections.data.${category}Label`) }}
                  </dt>
                  <dd class="mt-sm text-sm leading-relaxed">
                    {{ t(`privacy.sections.data.${category}Body`) }}
                  </dd>
                </div>
              </dl>
              <a
                v-if="section.key === 'rights'"
                href="https://www.mdes.go.th/law/detail/3577-Personal-Data--Protection-Act-B-E--"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-xs text-sm font-medium text-text-primary underline underline-offset-4"
              >
                {{ t('privacy.law') }}<ArrowUpRight :size="16" aria-hidden="true" />
              </a>
              <AppButton
                v-if="section.key === 'contact'"
                href="https://discord.gg/nRn7YDwGSH"
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                class="tablet:!w-auto"
              >
                {{ t('privacy.contact') }}<ArrowUpRight :size="18" aria-hidden="true" />
              </AppButton>
            </div>
          </section>
        </article>
      </div>
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
.privacy-section {
  scroll-margin-top: calc(var(--space-5xl) + var(--space-lg));
}
</style>
