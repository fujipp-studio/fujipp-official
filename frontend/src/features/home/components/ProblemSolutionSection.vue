<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { AppProgressiveImage } from '../../../shared/ui'
import { useScrollFade } from '../composables/useScrollFade'

const section = ref<HTMLElement>()
const fadeStyle = useScrollFade(section, 'both')
const { t } = useI18n()
</script>

<template>
  <section
    id="problem-solution"
    ref="section"
    class="problem-solution-section"
    aria-labelledby="problem-solution-title"
  >
    <h2 id="problem-solution-title" class="problem-solution-section__title" :style="fadeStyle">
      {{ t('home.problem.title') }}
    </h2>

    <div class="problem-solution-section__visual" :style="fadeStyle">
      <AppProgressiveImage
        class="problem-solution-section__image"
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

    <p class="problem-solution-section__description" :style="fadeStyle">
      {{ t('home.problem.description') }}
    </p>
  </section>
</template>

<style scoped>
.problem-solution-section {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  max-width: var(--layout-content-max-width);
  height: min(60rem, calc(100dvh - 4rem));
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: var(--space-lg);
  margin-inline: auto;
  overflow: hidden;
  padding: 0 var(--layout-page-gutter);
  text-align: left;
}

.problem-solution-section__title,
.problem-solution-section__description {
  width: min(100%, 37.5875rem);
  margin: 0;
}

.problem-solution-section__title {
  font-size: var(--font-size-display-small);
  font-weight: var(--typography-font-weight-bold);
  line-height: var(--line-height-display);
}

.problem-solution-section__description {
  margin-top: calc(var(--space-lg) * -1);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.problem-solution-section__visual {
  position: relative;
  width: min(100%, 32rem);
  height: min(28.76875rem, 54vw);
  flex-shrink: 0;
}

.problem-solution-section__image {
  position: absolute;
  top: 0;
  left: 0.4375rem;
  width: min(31.30625rem, calc(100% - 0.875rem));
  height: min(28.76875rem, 100%);
  background: transparent;
  filter: drop-shadow(var(--effect-shadow-xl));
}

@media (max-width: 47.99rem) {
  .problem-solution-section {
    height: calc(100dvh - 4rem);
  }

  .problem-solution-section__visual {
    width: 112%;
    height: 64vw;
    margin-left: -6%;
  }
}

</style>
