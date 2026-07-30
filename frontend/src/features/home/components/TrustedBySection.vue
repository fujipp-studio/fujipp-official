<script setup lang="ts">
import { ref } from 'vue'

import { trustedCommunities } from '../config'
import { useScrollFade } from '../composables/useScrollFade'

const section = ref<HTMLElement>()
const fadeStyle = useScrollFade(section, 'both')
</script>

<template>
  <section
    id="trusted-by"
    ref="section"
    class="trusted-by-section"
    aria-labelledby="trusted-by-title"
  >
    <div class="trusted-by-section__container" :style="fadeStyle">
      <div class="trusted-by-section__copy">
        <h2 id="trusted-by-title">Trusted by Real Server Owners</h2>
        <p>
          Join our growing community! Currently powering custom bots and delivering smooth
          experiences for 3 active Discord communities.
        </p>
      </div>

      <ul class="trusted-by-section__communities" aria-label="Trusted communities">
        <li v-for="community in trustedCommunities" :key="community.name">
          <img :src="community.image" :alt="community.name" />
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.trusted-by-section {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  max-width: var(--layout-content-max-width);
  height: min(60rem, calc(100dvh - 4rem));
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  margin-inline: auto;
  overflow: hidden;
  padding: 0 var(--layout-page-gutter);
  color: var(--semantic-color-text-text-inverse);
  text-align: center;
}

.trusted-by-section__container {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  max-width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-lg);
  border: 1px solid color-mix(in srgb, var(--semantic-color-border-border-default) 35%, transparent);
  border-radius: var(--corner-radius-lg);
  padding: var(--space-5xl) var(--space-xl);
  background: color-mix(
    in srgb,
    var(--semantic-color-background-bg-inverse) 70%,
    transparent
  );
  backdrop-filter: blur(var(--effect-backdrop-blur-sm));
}

.trusted-by-section__copy {
  display: flex;
  align-self: stretch;
  flex-direction: column;
  align-items: flex-start;
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
  align-self: stretch;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.trusted-by-section__communities img {
  width: 8rem;
  height: 8rem;
  object-fit: contain;
}

@media (max-width: 47.99rem) {
  .trusted-by-section {
    height: calc(100dvh - 4rem);
  }

  .trusted-by-section__container {
    padding: var(--space-3xl) var(--space-md);
  }

  .trusted-by-section__communities {
    gap: var(--space-xs);
  }

  .trusted-by-section__communities img {
    width: min(25vw, 6rem);
    height: min(25vw, 6rem);
  }
}
</style>
