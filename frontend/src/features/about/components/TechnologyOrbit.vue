<script setup lang="ts">
import { computed, ref } from 'vue'
import { Code2, Pause, Play } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import darkMark from '@/assets/brand/fujipp-mark-tab-dark.svg'
import lightMark from '@/assets/brand/fujipp-mark-tab-light.svg'
import { useThemeStore } from '@/stores'
import { useAnimationVisibility } from '@/shared/ui/useAnimationVisibility'
import { skillGroups, type SkillItem } from '../config'
import TechnologyIcon from './TechnologyIcon.vue'

const { t } = useI18n()
const { isDarkTheme } = storeToRefs(useThemeStore())
const stage = ref<HTMLElement>()
const motionActive = ref(false)
const paused = ref(false)
const hovered = ref<SkillItem | null>(null)
const focused = ref<SkillItem | null>(null)
const selected = computed(() => focused.value ?? hovered.value)
const orbits = [
  {
    groups: skillGroups.slice(0, 2),
    diameter: '30%',
    duration: '80s',
    direction: 'normal',
    phase: -90,
  },
  {
    groups: skillGroups.slice(2, 4),
    diameter: '56%',
    duration: '110s',
    direction: 'reverse',
    phase: -60,
  },
  {
    groups: skillGroups.slice(4, 6),
    diameter: '82%',
    duration: '140s',
    direction: 'normal',
    phase: -90,
  },
].map((orbit) => ({ ...orbit, skills: orbit.groups.flatMap((group) => group.skills) }))

useAnimationVisibility(stage, (active) => {
  motionActive.value = active
})

function position(index: number, count: number, phase: number) {
  const angle = (((index / count) * 360 + phase) * Math.PI) / 180
  return { left: `${50 + Math.cos(angle) * 50}%`, top: `${50 + Math.sin(angle) * 50}%` }
}
</script>

<template>
  <div class="technology-orbit">
    <div
      ref="stage"
      class="orbit-stage"
      :class="{ 'orbit-stage--paused': paused || !motionActive || Boolean(selected) }"
    >
      <div class="orbit-center" aria-hidden="true">
        <img :src="isDarkTheme ? darkMark : lightMark" alt="" width="64" height="64" />
      </div>
      <ul
        v-for="(orbit, ringIndex) in orbits"
        :key="ringIndex"
        class="orbit-ring"
        :class="{ 'orbit-ring--dashed': ringIndex === 1 }"
        :aria-label="orbit.groups.map((group) => t(group.titleKey)).join(' / ')"
        :style="{
          '--orbit-diameter': orbit.diameter,
          '--orbit-duration': orbit.duration,
          '--orbit-direction': orbit.direction,
        }"
      >
        <li
          v-for="(skill, index) in orbit.skills"
          :key="skill.label"
          class="orbit-position"
          :style="position(index, orbit.skills.length, orbit.phase)"
        >
          <span class="orbit-counter-rotation">
            <span
              class="orbit-badge"
              tabindex="0"
              role="img"
              :aria-label="skill.label"
              @mouseenter="hovered = skill"
              @mouseleave="hovered = null"
              @focus="focused = skill"
              @blur="focused = null"
            >
              <TechnologyIcon v-if="skill.icon" :icon="skill.icon" aria-hidden="true" />
              <Code2 v-else aria-hidden="true" />
            </span>
          </span>
        </li>
      </ul>
    </div>
    <div class="orbit-controls">
      <p class="orbit-caption" :class="{ 'orbit-caption--selected': selected }">
        {{ selected?.label ?? t('about.skills.orbitHint') }}
      </p>
      <button class="orbit-toggle" type="button" @click="paused = !paused">
        <Play v-if="paused" aria-hidden="true" />
        <Pause v-else aria-hidden="true" />
        {{ t(paused ? 'about.skills.resumeMotion' : 'about.skills.pauseMotion') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.technology-orbit {
  min-width: 0;
  width: 100%;
}

.orbit-stage {
  --orbit-node-size: clamp(var(--icon-size-32), 8cqi, calc(var(--icon-size-32) + var(--space-lg)));
  position: relative;
  container-type: inline-size;
  isolation: isolate;
  width: 100%;
  aspect-ratio: 1;
  background: radial-gradient(
    circle,
    var(--semantic-color-background-bg-surface) 0%,
    transparent 66%
  );
}

.orbit-center {
  position: absolute;
  inset: 43%;
  display: grid;
  place-items: center;
  border: 1px solid var(--semantic-color-border-border-strong);
  border-radius: var(--corner-radius-full);
  background: var(--semantic-color-background-bg-surface);
  box-shadow: var(--effect-shadow-lg);
}

.orbit-center::before {
  position: absolute;
  inset: calc(var(--space-xs) * -1);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: inherit;
  content: '';
}

.orbit-center img {
  width: 60%;
  height: auto;
}

.orbit-ring {
  position: absolute;
  inset: 0;
  width: var(--orbit-diameter);
  height: var(--orbit-diameter);
  margin: auto;
  padding: 0;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-full);
  list-style: none;
  /* Transparent ring layers must not cover the logos on inner rings. */
  pointer-events: none;
  animation: orbit-turn var(--orbit-duration) linear infinite;
  animation-direction: var(--orbit-direction);
}

.orbit-ring--dashed {
  border-style: dashed;
}

.orbit-position {
  position: absolute;
  width: var(--orbit-node-size);
  height: var(--orbit-node-size);
  transform: translate(-50%, -50%);
}

.orbit-counter-rotation {
  display: block;
  width: 100%;
  height: 100%;
  animation: orbit-counter-turn var(--orbit-duration) linear infinite;
  animation-direction: var(--orbit-direction);
}

.orbit-badge {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  pointer-events: auto;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-full);
  background: var(--semantic-color-background-bg-default);
  color: var(--semantic-color-text-text-primary);
  box-shadow: var(--effect-shadow-sm);
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}

.orbit-badge :deep(svg) {
  width: 50%;
  height: 50%;
}

.orbit-badge:hover,
.orbit-badge:focus-visible {
  border-color: var(--semantic-color-border-border-strong);
  background: var(--semantic-color-background-bg-surface-hover);
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: var(--space-xxs);
}

.orbit-stage--paused .orbit-ring,
.orbit-stage--paused .orbit-counter-rotation,
.orbit-stage:focus-within .orbit-ring,
.orbit-stage:focus-within .orbit-counter-rotation {
  animation-play-state: paused;
}

.orbit-controls {
  display: grid;
  justify-items: center;
  gap: var(--space-sm);
}

.orbit-caption {
  margin: 0;
  min-height: var(--space-lg);
  color: var(--semantic-color-text-text-muted);
  font-size: var(--font-size-label-medium);
  text-align: center;
}

.orbit-caption--selected {
  color: var(--semantic-color-text-text-primary);
  font-weight: var(--typography-font-weight-semibold);
}

.orbit-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-full);
  padding: var(--space-xs) var(--space-md);
  background: var(--semantic-color-background-bg-surface);
  color: var(--semantic-color-text-text-secondary);
  font: inherit;
  font-size: var(--font-size-label-medium);
  cursor: pointer;
}

.orbit-toggle svg {
  width: var(--icon-size-16);
  height: var(--icon-size-16);
}

.orbit-toggle:hover {
  border-color: var(--semantic-color-border-border-strong);
}

.orbit-toggle:focus-visible {
  outline: 2px solid var(--semantic-color-action-borders-border-focus);
  outline-offset: var(--space-xxs);
}

@keyframes orbit-turn {
  to {
    transform: rotate(360deg);
  }
}
@keyframes orbit-counter-turn {
  to {
    transform: rotate(-360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .orbit-ring,
  .orbit-counter-rotation {
    animation: none;
  }
  .orbit-badge {
    transition: none;
  }
  .orbit-toggle {
    display: none;
  }
}
</style>
