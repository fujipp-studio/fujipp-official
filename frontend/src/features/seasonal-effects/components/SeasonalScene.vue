<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SeasonalEffect } from '../api'
import SeasonalArtwork from './SeasonalArtwork.vue'

const props = withDefaults(defineProps<{
  effect: SeasonalEffect
  mobile?: boolean
  still?: boolean
}>(), { mobile: false, still: false })
const visits = ref<Record<number, number>>({})

// Generate once per effect/viewport change; animation frames stay entirely in CSS.
const particles = computed(() => {
  const count = props.still ? (props.effect === 'HALLOWEEN' ? 4 : 3) :
    props.effect === 'HALLOWEEN' ? (props.mobile ? 1 : 2) :
    props.effect === 'CHRISTMAS' ? (props.mobile ? 10 : 24) :
    props.effect === 'VALENTINE' ? (props.mobile ? 1 : 3) : 0
  if (props.effect === 'NONE') return []
  return Array.from({ length: count }, (_, index) => {
    const snow = props.effect === 'CHRISTMAS'
    const ghost = props.effect === 'HALLOWEEN'
    const duration = snow ? 14 + Math.random() * 12 : ghost ? 24 + Math.random() * 8 : 18 + Math.random() * 8
    const edge = 1 + Math.random() * 4
    const rightSide = !props.still && !snow && index % 2 === 1
    const left = snow ? Math.random() * 98 : edge
    return {
      id: index,
      variant: ghost && props.mobile ? Math.floor(Math.random() * 4) : (index + Math.floor(Math.random() * 4)) % 4,
      style: {
        '--particle-left': rightSide ? 'auto' : `${props.still ? 10 + index * (70 / Math.max(count - 1, 1)) : left}%`,
        '--particle-right': rightSide ? `${edge}%` : 'auto',
        '--particle-top': `${props.still ? 30 : ghost ? 18 + Math.random() * 42 : 0}%`,
        '--particle-size': `${snow ? 0.4 + Math.random() * 0.5 : ghost ? (props.mobile ? 2.5 : 3.5) : 0.7 + Math.random() * 0.5}rem`,
        '--particle-duration': `${duration}s`,
        '--particle-delay': `${snow ? -Math.random() * duration : index * 6}s`,
        '--particle-drift': `${ghost ? (rightSide ? -1 : 1) * (1 + Math.random() * 2) : (Math.random() - 0.5) * 3}rem`,
      },
    }
  })
})
</script>

<template>
  <div v-if="effect !== 'NONE'" data-seasonal-layer class="seasonal-scene" :class="[`seasonal-scene--${effect.toLowerCase()}`, { 'seasonal-scene--still': still }]" aria-hidden="true">
    <span v-for="particle in particles" :key="particle.id" class="seasonal-particle" :style="particle.style" @animationiteration="effect === 'HALLOWEEN' && (visits[particle.id] = ((visits[particle.id] ?? 0) + 1) % 4)">
      <SeasonalArtwork :effect="effect" :variant="(particle.variant + (visits[particle.id] ?? 0)) % 4" />
    </span>
  </div>
</template>

<style scoped>
.seasonal-scene { position: absolute; inset: 0; overflow: hidden; pointer-events: none; user-select: none; contain: strict; }
.seasonal-particle { position: absolute; left: var(--particle-left); right: var(--particle-right); top: var(--particle-top); width: var(--particle-size); height: var(--particle-size); opacity: 0; animation-duration: var(--particle-duration); animation-delay: var(--particle-delay); animation-iteration-count: infinite; animation-timing-function: linear; }
.seasonal-scene--halloween .seasonal-particle { height: calc(var(--particle-size) * 1.16); animation-name: ghost-visit; }
.seasonal-scene--christmas .seasonal-particle { animation-name: snowfall; }
.seasonal-scene--christmas { mask-image: linear-gradient(to right, var(--semantic-color-seasonal-snow), color-mix(in srgb, var(--semantic-color-seasonal-snow) 55%, transparent) 30%, color-mix(in srgb, var(--semantic-color-seasonal-snow) 55%, transparent) 70%, var(--semantic-color-seasonal-snow)); }
.seasonal-scene--valentine .seasonal-particle { top: auto; bottom: 0; animation-name: heart-visit; }
.seasonal-scene--still .seasonal-particle { animation: none; opacity: 0.85; top: 35%; bottom: auto; }
@keyframes ghost-visit {
  0%, 8%, 78%, 100% { opacity: 0; transform: translate3d(0, 2rem, 0) rotate(-6deg); }
  20%, 56% { opacity: 0.78; }
  38% { transform: translate3d(var(--particle-drift), -2rem, 0) rotate(5deg); }
  68% { opacity: 0; transform: translate3d(0, -4rem, 0) rotate(-3deg); }
}
@keyframes snowfall {
  0% { opacity: 0; transform: translate3d(0, -2rem, 0); }
  12%, 85% { opacity: 0.4; }
  50% { transform: translate3d(var(--particle-drift), 50cqh, 0); }
  100% { opacity: 0; transform: translate3d(0, 102cqh, 0); }
}
@keyframes heart-visit {
  0%, 8%, 76%, 100% { opacity: 0; transform: translate3d(0, 2rem, 0) rotate(-8deg); }
  22%, 42% { opacity: 0.55; }
  65% { opacity: 0; transform: translate3d(var(--particle-drift), -58cqh, 0) rotate(12deg); }
}
@media (prefers-reduced-motion: reduce) {
  .seasonal-particle { animation: none; display: none; }
  .seasonal-scene--still .seasonal-particle { display: block; }
}
</style>
