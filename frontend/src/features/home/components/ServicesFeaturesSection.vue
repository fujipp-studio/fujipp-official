<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { homeFeatures } from '../config'
import { useScrollFade } from '../composables/useScrollFade'

const section = ref<HTMLElement>()
const fadeStyle = useScrollFade(section, 'both')
const { t } = useI18n()
</script>

<template>
  <section
    id="services-features"
    ref="section"
    class="services-features-section"
    aria-labelledby="services-features-title"
  >
    <div class="services-features-section__content" :style="fadeStyle">
      <h2 id="services-features-title">{{ t('home.services.title') }}</h2>

      <article
        v-for="feature in homeFeatures"
        :key="feature.titleKey"
        class="services-features-section__feature"
      >
        <h3>{{ t(feature.titleKey) }}</h3>
        <p>{{ t(feature.descriptionKey) }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.services-features-section {
  box-sizing: border-box;
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

.services-features-section__content {
  display: flex;
  width: min(100%, 36rem);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xxs);
}

.services-features-section h2,
.services-features-section h3,
.services-features-section p {
  margin: 0;
}

.services-features-section h2 {
  align-self: stretch;
  margin-bottom: var(--space-sm);
  font-size: var(--font-size-display-small);
  font-weight: var(--typography-font-weight-bold);
  line-height: var(--line-height-display);
}

.services-features-section__feature {
  display: flex;
  align-self: stretch;
  flex-direction: column;
  gap: var(--space-xxs);
}

.services-features-section__feature + .services-features-section__feature {
  margin-top: var(--space-sm);
}

.services-features-section h3 {
  font-size: var(--font-size-body-large);
  font-weight: var(--typography-font-weight-semibold);
  line-height: var(--line-height-heading);
}

.services-features-section p {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

@media (max-width: 47.99rem) {
  .services-features-section {
    height: calc(100dvh - 4rem);
  }
}

</style>
