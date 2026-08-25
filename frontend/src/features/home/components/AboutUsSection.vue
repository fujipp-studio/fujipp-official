<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { icons } from '../../../config'
import { AppButton, AppProgressiveImage } from '../../../shared/ui'
import { useThemeStore } from '../../../stores'
import { useScrollFade } from '../composables/useScrollFade'

const section = ref<HTMLElement>()
const fadeStyle = useScrollFade(section, 'both')
const router = useRouter()
const { locale, t } = useI18n()
const { isDarkTheme } = storeToRefs(useThemeStore())
const profileImageSrc = computed(() =>
  isDarkTheme.value
    ? '/images/about/anawat-grudtoop-profile-cropped-768.webp'
    : '/images/about/anawat-grudtoop-profile-512.webp',
)
const profilePlaceholderSrc = computed(() =>
  isDarkTheme.value
    ? '/images/about/anawat-grudtoop-profile-cropped-lqip.webp'
    : '/images/about/anawat-grudtoop-profile-512-lqip.webp',
)

function navigateTo(path: '/about' | '/work') {
  void router.push({ path, query: locale.value === 'th' ? { locale: 'th' } : {} })
}
</script>

<template>
  <section
    id="about-us"
    ref="section"
    class="about-us-section"
    aria-labelledby="about-us-title"
  >
    <div class="about-us-section__layout" :style="fadeStyle">
      <div class="about-us-section__portrait">
        <AppProgressiveImage
          class="about-us-section__image"
          :src="profileImageSrc"
          :placeholder-src="profilePlaceholderSrc"
          :alt="t('home.about.imageAlt')"
          width="512"
          height="512"
          loading="lazy"
          fit="cover"
        />
      </div>

      <div class="about-us-section__content">
        <h2 id="about-us-title">{{ t('home.about.title') }}</h2>
        <p>{{ t('home.about.description') }}</p>

        <div class="about-us-section__actions">
          <AppButton
            variant="primary"
            :right-icon="icons.base.arrowRight"
            @click="navigateTo('/about')"
          >
            {{ t('home.about.aboutAction') }}
          </AppButton>
          <AppButton variant="secondary" @click="navigateTo('/work')">
            {{ t('home.about.workAction') }}
          </AppButton>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about-us-section {
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

.about-us-section__layout {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(16rem, 0.8fr) minmax(0, 1.2fr);
  align-items: center;
  gap: var(--space-3xl);
}

.about-us-section__portrait {
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  aspect-ratio: 1;
}

.about-us-section__image {
  width: 100%;
  height: 100%;
}

.about-us-section__content {
  display: flex;
  width: min(100%, var(--layout-reading-max-width));
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm);
}

.about-us-section h2,
.about-us-section p {
  align-self: stretch;
  margin: 0;
}

.about-us-section h2 {
  font-size: var(--font-size-display-small);
  font-weight: var(--typography-font-weight-bold);
  line-height: var(--line-height-display);
}

.about-us-section p {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

.about-us-section__actions {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
  margin-top: var(--space-sm);
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

  .about-us-section__portrait {
    width: min(100%, 20rem);
  }

  .about-us-section__actions {
    grid-template-columns: 1fr;
  }
}
</style>
