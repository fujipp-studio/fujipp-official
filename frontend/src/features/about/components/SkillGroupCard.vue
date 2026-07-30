<script setup lang="ts">
import { Box, Code2, Database, Monitor, Server } from 'lucide-vue-next'

import type { SkillGroup } from '../config'
import TechnologyIcon from './TechnologyIcon.vue'

defineProps<{
  group: SkillGroup
}>()

const categoryIcons = {
  language: Code2,
  frontend: Monitor,
  backend: Server,
  database: Database,
  infra: Box,
}
</script>

<template>
  <article class="skill-group-card" :class="`skill-group-card--${group.category}`">
    <h3>
      <component :is="categoryIcons[group.category]" :size="24" :stroke-width="1.75" />
      <span>{{ group.title }}</span>
    </h3>

    <ul>
      <li v-for="skill in group.skills" :key="skill.label">
        <TechnologyIcon :icon="skill.icon" />
        <span>{{ skill.label }}</span>
      </li>
    </ul>
  </article>
</template>

<style scoped>
.skill-group-card {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  min-width: 0;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  padding: var(--space-xl);
  background: color-mix(in srgb, var(--semantic-color-background-bg-glass) 38%, transparent);
  backdrop-filter: blur(var(--effect-backdrop-blur-sm));
}

.skill-group-card--infra {
  grid-column: 1 / -1;
}

.skill-group-card h3 {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin: 0 0 var(--space-lg);
  font-size: var(--font-size-heading-h1);
  line-height: var(--line-height-heading);
}

.skill-group-card ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.skill-group-card li {
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  gap: var(--space-xs);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-full);
  padding: var(--space-xs) var(--space-md);
  background: var(--semantic-color-background-bg-glass);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-large);
  font-weight: var(--typography-font-weight-medium);
  white-space: nowrap;
}

@media (max-width: 47.99rem) {
  .skill-group-card {
    padding: var(--space-lg);
  }

  .skill-group-card li {
    padding-inline: var(--space-sm);
    font-size: var(--font-size-label-medium);
  }
}

</style>
