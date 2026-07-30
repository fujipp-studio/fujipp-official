<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { AppFooter } from '../../../shared/layout'
import {
  AboutUsSection,
  ProblemSolutionSection,
  ScrollProgressIndicator,
  ServicesFeaturesSection,
  TrustedBySection,
} from '../components'
import { useScrollFade } from '../composables/useScrollFade'

const heroSection = ref<HTMLElement>()
const heroFadeStyle = useScrollFade(heroSection, 'exit')

onMounted(() => document.documentElement.classList.add('home-section-scroll'))
onBeforeUnmount(() => document.documentElement.classList.remove('home-section-scroll'))
</script>

<template>
  <div class="home-page">
    <div class="home-background" aria-hidden="true">
      <img src="/images/home/hero-background-4k.png" alt="" />
      <div class="home-background__blur" />
      <div class="home-background__fade" />
    </div>

    <ScrollProgressIndicator />
    <main class="home-main">
      <section id="home-hero" ref="heroSection" class="home-hero">
        <div class="home-hero__copy" :style="heroFadeStyle">
          <h1>Building ideas into</h1>
          <p class="home-hero__accent">real experiences.</p>
          <p class="home-hero__summary">
            A personal platform for thoughtful software, practical projects, and Discord bot
            services built to run reliably.
          </p>
        </div>
      </section>

      <ProblemSolutionSection />
      <ServicesFeaturesSection />
      <TrustedBySection />
      <AboutUsSection />
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.home-page {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  align-items: center;
  overflow-x: clip;
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
}

.home-background {
  position: fixed;
  z-index: -1;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.home-background img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: right center;
}

.home-background__blur {
  position: absolute;
  inset-block: 0;
  left: 0;
  width: 62%;
  background: color-mix(in srgb, var(--semantic-color-background-bg-default) 62%, transparent);
  backdrop-filter: blur(var(--effect-glow-blur-lg));
  mask-image: linear-gradient(90deg, #000 0%, #000 42%, transparent 100%);
}

.home-background__fade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--semantic-color-background-bg-default) 0%,
    color-mix(in srgb, var(--semantic-color-background-bg-default) 90%, transparent) 24%,
    color-mix(in srgb, var(--semantic-color-background-bg-default) 48%, transparent) 47%,
    transparent 70%
  );
}

.home-main {
  display: flex;
  width: 100%;
  flex: 1;
  flex-direction: column;
}

.home-hero {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  max-width: var(--layout-content-max-width);
  min-height: calc(100dvh - 4rem);
  align-items: center;
  margin-inline: auto;
  padding: var(--space-4xl) var(--layout-page-gutter);
}

.home-hero__copy {
  display: flex;
  width: min(100%, 36rem);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
}

.home-hero__copy h1,
.home-hero__copy p {
  margin: 0;
}

.home-hero__copy h1 {
  font-size: var(--font-size-display-large);
  font-weight: var(--typography-font-weight-bold);
  line-height: var(--line-height-display);
}

.home-hero__accent {
  color: var(--semantic-color-text-text-accent);
  font-family: var(--font-family-handwriting);
  font-size: clamp(3rem, 6vw, 5.25rem);
  line-height: 0.95;
}

.home-hero__summary {
  max-width: 34rem;
  margin-top: var(--space-sm) !important;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-large);
  line-height: var(--line-height-body);
}

@media (max-width: 47.99rem) {
  .home-background img {
    object-position: 62% center;
  }

  .home-background__blur {
    width: 100%;
    background: color-mix(in srgb, var(--semantic-color-background-bg-default) 35%, transparent);
    mask-image: linear-gradient(180deg, transparent 0%, #000 58%, #000 100%);
  }

  .home-background__fade {
    background: linear-gradient(
      180deg,
      transparent 15%,
      color-mix(in srgb, var(--semantic-color-background-bg-default) 45%, transparent) 48%,
      color-mix(in srgb, var(--semantic-color-background-bg-default) 88%, transparent) 82%
    );
  }

  .home-hero {
    min-height: calc(100dvh - 4rem);
    align-items: flex-end;
    padding-bottom: var(--space-4xl);
  }
}

</style>
