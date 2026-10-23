<script setup lang="ts">
import type { SeasonalEffect } from '../api'
withDefaults(defineProps<{ effect: SeasonalEffect; variant?: number }>(), { variant: 0 })
</script>

<template>
  <svg v-if="effect === 'HALLOWEEN'" viewBox="0 0 96 112" fill="none" aria-hidden="true" class="seasonal-artwork">
    <path class="ghost-body" d="M19 76V40C19 23 31 12 48 12s29 11 29 28v36l5 17c1 4-2 7-6 5l-10-5-10 7-10-7-11 7-10-6-10 4c-4 1-6-2-5-5z" />
    <path v-if="variant === 0" class="ghost-body" d="M20 55C6 48 4 35 10 33c6-2 5 9 13 9M75 56c11-7 15-4 13 1-2 5-6 8-12 10" />
    <path v-else-if="variant === 1" class="ghost-body" d="M23 66c12-9 17-7 16-1-1 5-8 8-15 9m49-8c-12-9-17-7-16-1 1 5 8 8 15 9" />
    <path v-else-if="variant === 2" class="ghost-body" d="M21 55C9 49 6 54 10 59l11 8m54-12c12-6 15-1 11 4L75 67" />
    <path v-else class="ghost-body" d="M23 60c8 5 11 10 6 13m44-13c-8 5-11 10-6 13" />
    <g class="ghost-face" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">
      <template v-if="variant === 3">
        <path d="M32 44q5 5 10 0m14 0q5 5 10 0" />
        <ellipse cx="49" cy="57" rx="3" ry="4" />
      </template>
      <template v-else>
        <ellipse :cx="variant === 1 ? 38 : 35" cy="44" rx="2.5" ry="4" />
        <ellipse :cx="variant === 1 ? 58 : 61" cy="44" rx="2.5" ry="4" />
        <path v-if="variant === 2" d="M41 55q7 12 14 0z" />
        <path v-else d="M43 56q5 5 10 0" />
      </template>
    </g>
    <g class="ghost-cheeks"><ellipse cx="29" cy="53" rx="5" ry="3" /><ellipse cx="67" cy="53" rx="5" ry="3" /></g>
  </svg>
  <svg v-else-if="effect === 'CHRISTMAS'" viewBox="0 0 24 24" aria-hidden="true" class="seasonal-artwork snow-artwork">
    <circle cx="12" cy="12" r="5" />
  </svg>
  <svg v-else-if="effect === 'VALENTINE'" viewBox="0 0 32 32" aria-hidden="true" class="seasonal-artwork heart-artwork">
    <path d="M16 28 4 16C-4 6 9-2 16 7c7-9 20-1 12 9z" />
  </svg>
</template>

<style scoped>
.seasonal-artwork { display: block; width: 100%; height: 100%; overflow: visible; }
.ghost-body { fill: var(--semantic-color-seasonal-ghost-body); stroke: var(--semantic-color-seasonal-ghost-outline); stroke-width: 1.5; stroke-linejoin: round; }
.ghost-face { fill: var(--semantic-color-seasonal-ghost-ink); stroke: var(--semantic-color-seasonal-ghost-ink); }
.ghost-cheeks { fill: var(--semantic-color-seasonal-blush); opacity: 0.65; }
.snow-artwork { fill: var(--semantic-color-seasonal-snow); }
.heart-artwork { fill: var(--semantic-color-seasonal-heart); }
</style>
