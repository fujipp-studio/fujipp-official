<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { AppFooter } from '@/shared/layout'

const { t, locale } = useI18n()
const sections = ['scope', 'account', 'services', 'payments', 'support', 'issues', 'conduct', 'content', 'changes'] as const
</script>

<template>
  <div class="min-h-screen bg-bg-default text-text-primary">
    <main class="page-container pb-3xl pt-28 desktop:pt-36">
      <header class="border-b border-border-subtle pb-2xl">
        <h1 class="text-4xl font-medium tracking-tight tablet:text-5xl desktop:text-7xl">{{ t('terms.title') }}</h1>
        <p class="mt-lg max-w-reading text-lg leading-relaxed text-text-secondary">{{ t('terms.description') }}</p>
        <time datetime="2026-10-22" class="mt-lg block text-sm text-text-secondary">{{ t('terms.updated') }}</time>
      </header>
      <div class="mt-2xl grid items-start gap-2xl desktop:grid-cols-12 desktop:gap-3xl">
        <nav :aria-label="t('terms.contents')" class="desktop:sticky desktop:top-28 desktop:col-span-3">
          <h2 class="mb-lg text-sm text-text-secondary">{{ t('terms.contents') }}</h2>
          <ol class="grid gap-md">
            <li v-for="(section, index) in sections" :key="section">
              <a :href="`#terms-${section}`" class="flex gap-sm text-sm text-text-secondary hover:text-text-primary">
                <span class="font-mono" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
                {{ t(`terms.sections.${section}.title`) }}
              </a>
            </li>
          </ol>
        </nav>
        <article class="min-w-0 max-w-reading space-y-2xl desktop:col-span-9">
          <section v-for="section in sections" :id="`terms-${section}`" :key="section" :aria-labelledby="`terms-${section}-title`" class="terms-section border-b border-border-subtle pb-2xl">
            <h2 :id="`terms-${section}-title`" class="text-2xl font-medium">{{ t(`terms.sections.${section}.title`) }}</h2>
            <p class="mt-lg leading-relaxed text-text-secondary">{{ t(`terms.sections.${section}.body`, { email: 'anawat.boripakhirun@gmail.com' }) }}</p>
          </section>
          <div class="flex flex-wrap gap-lg">
            <RouterLink :to="{ path: '/privacy', query: locale === 'th' ? { locale: 'th' } : {} }" class="underline underline-offset-4">{{ t('terms.privacy') }}</RouterLink>
            <a href="mailto:anawat.boripakhirun@gmail.com" class="underline underline-offset-4">{{ t('terms.contact') }}</a>
          </div>
        </article>
      </div>
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
.terms-section {
  scroll-margin-top: var(--space-5xl);
}
</style>
