<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { icons } from '../../../config'
import { AppButton } from '../../../shared/ui'
import { useScrollFade } from '../composables/useScrollFade'

const section = ref<HTMLElement>()
const fadeStyle = useScrollFade(section, 'both')
const router = useRouter()

function viewProjects() {
  void router.push('/work')
}
</script>

<template>
  <section
    id="about-us"
    ref="section"
    class="about-us-section"
    aria-labelledby="about-us-title"
  >
    <div class="about-us-section__content" :style="fadeStyle">
      <h2 id="about-us-title">The Developer Behind the Bots</h2>
      <p>
        More than just a bot shop, this platform is my personal web application and portfolio. I
        built this space to showcase my development skills while providing top-tier Discord bot
        services for server creators. Let&apos;s build something awesome together!
      </p>

      <div class="about-us-section__button">
        <AppButton
          variant="primary"
          :right-icon="icons.base.arrowRight"
          @click="viewProjects"
        >
          View all my projects
        </AppButton>
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

.about-us-section__content {
  display: flex;
  width: min(100%, 36rem);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xxs);
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

.about-us-section__button {
  width: fit-content;
  margin-top: calc(var(--space-lg) - var(--space-xxs));
}

@media (max-width: 47.99rem) {
  .about-us-section {
    height: calc(100dvh - 4rem);
  }
}
</style>
