<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { AppProgressiveImage } from '../../../shared/ui'
import { homeFeatures } from '../config'
const { t } = useI18n()
</script>

<template>
  <section
    id="discord-bot-services"
    class="bot-services-section"
    aria-labelledby="bot-services-title"
  >
    <div class="bot-services-section__content">
      <div class="bot-services-section__intro">
        <div class="bot-services-section__copy">
          <h2 id="bot-services-title">{{ t('home.problem.title') }}</h2>
          <p>{{ t('home.problem.description') }}</p>
        </div>

        <div class="bot-services-section__visual">
          <AppProgressiveImage
            class="bot-services-section__image"
            src="/images/home/developer-portal-display-640.webp"
            placeholder-src="/images/home/developer-portal-display-lqip.webp"
            srcset="
              /images/home/developer-portal-display-640.webp 640w,
              /images/home/developer-portal-display-1024.webp 1024w
            "
            sizes="(max-width: 768px) calc(100vw - 2rem), 512px"
            width="1024"
            height="1054"
            :alt="t('home.problem.imageAlt')"
            loading="lazy"
            fit="contain"
          />
        </div>
      </div>

      <div class="bot-services-section__features">
        <article
          v-for="feature in homeFeatures"
          :key="feature.titleKey"
          class="bot-services-section__feature"
        >
          <h3>{{ t(feature.titleKey) }}</h3>
          <p>{{ t(feature.descriptionKey) }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bot-services-section {
  box-sizing: border-box;
  content-visibility: auto;
  contain-intrinsic-block-size: 100dvh;
  display: flex;
  width: 100%;
  max-width: var(--layout-content-max-width);
  min-height: calc(100dvh - 4rem);
  flex-shrink: 0;
  align-items: center;
  margin-inline: auto;
  overflow: hidden;
  padding: var(--space-4xl) var(--layout-page-gutter);
  text-align: left;
}

.bot-services-section__content {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: var(--space-xl);
}

.bot-services-section__intro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.85fr);
  align-items: center;
  gap: var(--space-2xl);
}

.bot-services-section__copy {
  display: flex;
  max-width: 38rem;
  flex-direction: column;
  gap: var(--space-sm);
}

.bot-services-section h2,
.bot-services-section h3,
.bot-services-section p {
  margin: 0;
}

.bot-services-section h2 {
  font-size: var(--font-size-display-small);
  font-weight: var(--typography-font-weight-bold);
  line-height: var(--line-height-display);
}

.bot-services-section__copy p,
.bot-services-section__feature p {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.bot-services-section__visual {
  height: min(23rem, 36vw);
  min-height: 16rem;
}

.bot-services-section__image {
  width: 100%;
  height: 100%;
  background: transparent;
  filter: drop-shadow(var(--effect-shadow-xl));
}

.bot-services-section__features {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
}

.bot-services-section__feature {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-xs);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  padding: var(--space-lg);
  background: var(--semantic-color-background-bg-elevated);
}

.bot-services-section__feature h3 {
  font-size: var(--font-size-heading-h3);
  font-weight: var(--typography-font-weight-semibold);
  line-height: var(--line-height-heading);
}

@media (max-width: 47.99rem) {
  .bot-services-section {
    min-height: calc(100dvh - 4rem);
    padding-block: var(--space-3xl);
  }

  .bot-services-section__intro {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-lg);
  }

  .bot-services-section__visual {
    width: 112%;
    height: 60vw;
    min-height: 12rem;
    margin-left: -6%;
  }

  .bot-services-section__features {
    grid-template-columns: 1fr;
  }
}
</style>
