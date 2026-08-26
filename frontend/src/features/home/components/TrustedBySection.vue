<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { trustedCommunities } from '../config'
import { AppProgressiveImage } from '../../../shared/ui'
const { t } = useI18n()
</script>

<template>
  <section
    id="trusted-by"
    class="trusted-by-section"
    aria-labelledby="trusted-by-title"
  >
    <div class="trusted-by-section__container">
      <div class="trusted-by-section__copy">
        <h2 id="trusted-by-title">{{ t('home.trusted.title') }}</h2>
        <p>{{ t('home.trusted.description') }}</p>
      </div>

      <ul class="trusted-by-section__communities" :aria-label="t('home.trusted.listLabel')">
        <li v-for="community in trustedCommunities" :key="community.name">
          <AppProgressiveImage
            class="trusted-by-section__community-image"
            :src="community.image"
            :placeholder-src="community.placeholderImage"
            :alt="community.name"
            width="512"
            height="512"
            loading="lazy"
            fit="contain"
          />
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.trusted-by-section {
  box-sizing: border-box;
  content-visibility: auto;
  contain-intrinsic-block-size: 100dvh;
  display: flex;
  width: 100%;
  max-width: var(--layout-content-max-width);
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  margin-inline: auto;
  overflow: hidden;
  padding: var(--space-4xl) var(--layout-page-gutter);
  color: var(--semantic-color-text-text-inverse);
  text-align: center;
}

.trusted-by-section__container {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  max-width: var(--layout-reading-max-width);
  flex-direction: column;
  align-items: center;
  gap: var(--space-xl);
  border: 1px solid color-mix(in srgb, var(--semantic-color-border-border-default) 35%, transparent);
  border-radius: var(--corner-radius-lg);
  padding: var(--space-2xl);
  background: color-mix(
    in srgb,
    var(--semantic-color-background-bg-inverse) 70%,
    transparent
  );
  backdrop-filter: blur(var(--effect-backdrop-blur-sm));
}

.trusted-by-section__copy {
  display: flex;
  width: 100%;
  max-width: var(--layout-reading-max-width);
  flex-direction: column;
  align-items: center;
  gap: var(--space-xxs);
}

.trusted-by-section h2,
.trusted-by-section p {
  align-self: stretch;
  margin: 0;
}

.trusted-by-section h2 {
  font-size: var(--font-size-display-small);
  font-weight: var(--typography-font-weight-bold);
  line-height: var(--line-height-display);
}

.trusted-by-section p {
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.trusted-by-section__communities {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.trusted-by-section__community-image {
  width: 6.5rem;
  height: 6.5rem;
  background: transparent;
}

@media (max-width: 47.99rem) {
  .trusted-by-section {
    padding-block: var(--space-3xl);
  }

  .trusted-by-section__container {
    gap: var(--space-lg);
    padding: var(--space-xl) var(--space-md);
  }

  .trusted-by-section__communities {
    gap: var(--space-xs);
  }

  .trusted-by-section__community-image {
    width: min(24vw, 5rem);
    height: min(24vw, 5rem);
  }
}
</style>
