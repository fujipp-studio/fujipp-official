<script setup lang="ts">
import { Code2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import type { SkillGroup } from '../config'
import TechnologyIcon from './TechnologyIcon.vue'

defineProps<{
  group: SkillGroup
}>()

const { t } = useI18n()

</script>

<template>
  <article class="skill-group-card" :class="`skill-group-card--${group.category}`">
    <h3>
      <span>{{ t(group.titleKey) }}</span>
    </h3>

    <ul>
      <li v-for="skill in group.skills" :key="skill.label">
        <TechnologyIcon v-if="skill.icon" :icon="skill.icon" />
        <Code2 v-else class="skill-group-card__fallback-icon" aria-hidden="true" />
        <span>{{ skill.label }}</span>
      </li>
    </ul>
  </article>
</template>

<style scoped>
.skill-group-card {
  display: grid;
  min-width: 0;
  gap: var(--space-lg);
  border-top: 1px solid var(--semantic-color-border-border-default);
  padding-block: var(--space-xl);
}

.skill-group-card h3 {
  margin: 0;
  color: var(--semantic-color-text-text-primary);
  font-size: var(--font-size-heading-h3);
  font-weight: var(--typography-font-weight-medium);
  line-height: var(--line-height-heading);
}

.skill-group-card ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg) var(--space-xl);
  margin: 0;
  padding: 0;
  list-style: none;
}

.skill-group-card li {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-medium);
  line-height: var(--line-height-body);
  transition: color 160ms ease;
}

.skill-group-card__fallback-icon {
  width: var(--icon-size-24);
  height: var(--icon-size-24);
  flex-shrink: 0;
  color: var(--semantic-color-text-text-primary);
}

.skill-group-card li:hover {
  color: var(--semantic-color-text-text-primary);
}

@media (min-width: 48rem) {
  .skill-group-card {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    align-items: baseline;
    gap: var(--space-2xl);
    padding-block: var(--space-2xl);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skill-group-card li {
    transition: none;
  }
}
</style>
