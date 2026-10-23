<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSeasonalEffectsStore, seasonalRefreshInterval } from '@/stores/seasonalEffects'
import { useSeasonalEnvironment } from '../useSeasonalEnvironment'
const SeasonalScene = defineAsyncComponent(() => import('./SeasonalScene.vue'))

const route = useRoute()
const store = useSeasonalEffectsStore()
const { mobile, reducedMotion, hidden, overlayOpen } = useSeasonalEnvironment()
const visible = computed(() => store.settings.effect !== 'NONE' && !reducedMotion.value &&
  !hidden.value && !overlayOpen.value && !route.path.startsWith('/admin') &&
  route.path !== '/auth/callback')
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0
const controller = new AbortController()

function stopTimer() {
  clearTimeout(timer)
  timer = undefined
}
async function check() {
  const run = ++generation
  stopTimer()
  if (document.hidden || controller.signal.aborted) return
  await store.refresh(controller.signal)
  if (run === generation && !document.hidden && !controller.signal.aborted)
    timer = setTimeout(() => void check(), seasonalRefreshInterval)
}
function visibilityChanged() {
  if (document.hidden) { generation++; stopTimer() }
  else void check()
}

onMounted(() => {
  document.addEventListener('visibilitychange', visibilityChanged)
  void check()
})
onBeforeUnmount(() => {
  stopTimer()
  controller.abort()
  document.removeEventListener('visibilitychange', visibilityChanged)
})
</script>

<template>
  <div v-if="visible" class="seasonal-effects" data-testid="seasonal-effects">
    <SeasonalScene :effect="store.settings.effect" :mobile="mobile" />
  </div>
</template>

<style scoped>
.seasonal-effects { position: fixed; inset: 0; z-index: var(--z-raised); pointer-events: none; container-type: size; }
</style>
