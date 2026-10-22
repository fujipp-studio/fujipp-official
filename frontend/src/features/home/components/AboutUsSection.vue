<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { AppTextLink } from '../../../shared/ui'
import DeveloperCodeCard from './DeveloperCodeCard.vue'

const { locale, t } = useI18n()

function localizedRoute(path: '/about' | '/work') {
  return { path, query: locale.value === 'th' ? { locale: 'th' } : {} }
}
</script>

<template>
  <section
    id="about-us"
    class="about-us-section"
    aria-labelledby="about-us-title"
  >
    <div class="about-us-section__layout">
      <DeveloperCodeCard />

      <div class="about-us-section__content">
        <h2 id="about-us-title">{{ t('home.about.title') }}</h2>
        <p>{{ t('home.about.description') }}</p>

        <div class="about-us-section__actions">
          <AppTextLink :to="localizedRoute('/about')">
            {{ t('home.about.aboutAction') }}
          </AppTextLink>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about-us-section {
  box-sizing: border-box;
  content-visibility: auto;
  contain-intrinsic-block-size: 100dvh;
  display: flex;
  width: 100%;
  max-width: var(--layout-content-max-width);
  height: min(60rem, calc(100dvh - 4rem));
  flex-shrink: 0;
  align-items: center;
  margin-inline: auto;
  overflow: hidden;
  padding: 0 var(--layout-page-gutter);
  text-align: left;
}

.about-us-section__layout {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  align-items: center;
  gap: clamp(var(--space-xl), 6vw, var(--space-5xl));
}

.about-us-section__content {
  display: flex;
  width: min(100%, var(--layout-reading-max-width));
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-lg);
}

.about-us-section h2,
.about-us-section p {
  align-self: stretch;
  margin: 0;
}

.about-us-section h2 {
  max-width: 18ch;
  font-size: clamp(2.25rem, 4.4vw, 4.75rem);
  font-weight: var(--typography-font-weight-medium);
  letter-spacing: -0.045em;
  line-height: 1.08;
}

.about-us-section p {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.about-us-section h2:lang(th) {
  letter-spacing: 0;
  line-height: 1.2;
}

.about-us-section__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md) var(--space-xl);
  margin-top: var(--space-lg);
}

@media (max-width: 47.99rem) {
  .about-us-section {
    height: auto;
    min-height: calc(100dvh - 4rem);
    padding-block: var(--space-3xl);
  }

  .about-us-section__layout {
    grid-template-columns: 1fr;
    gap: var(--space-xl);
  }



}
</style>
