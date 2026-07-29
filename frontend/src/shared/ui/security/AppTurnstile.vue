<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

type TurnstileWidgetId = string

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string
      theme: 'auto'
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => boolean
    },
  ): TurnstileWidgetId
  remove(widgetId: TurnstileWidgetId): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const props = defineProps<{
  siteKey: string
  resetKey?: number
}>()

const emit = defineEmits<{
  verify: [token: string]
  expired: []
  error: []
}>()

const container = ref<HTMLElement>()
let widgetId: TurnstileWidgetId | undefined
let disposed = false
let turnstileLoader: Promise<TurnstileApi> | undefined

async function renderWidget() {
  if (!container.value || !props.siteKey) return

  try {
    const turnstile = await loadTurnstile()
    if (disposed || !container.value) return
    if (widgetId) turnstile.remove(widgetId)

    widgetId = turnstile.render(container.value, {
      sitekey: props.siteKey,
      theme: 'auto',
      callback: (token) => emit('verify', token),
      'expired-callback': () => emit('expired'),
      'error-callback': () => {
        emit('error')
        return true
      },
    })
  } catch {
    emit('error')
  }
}

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (turnstileLoader) return turnstileLoader

  turnstileLoader = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-fujipp-turnstile]',
    )
    const script = existingScript ?? document.createElement('script')

    const handleLoad = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Cloudflare Turnstile did not initialize.'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener(
      'error',
      () => reject(new Error('Unable to load Cloudflare Turnstile.')),
      { once: true },
    )

    if (!existingScript) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.fujippTurnstile = ''
      document.head.append(script)
    }
  })

  return turnstileLoader
}

watch(
  () => props.resetKey,
  () => void renderWidget(),
)

onMounted(() => void renderWidget())
onBeforeUnmount(() => {
  disposed = true
  if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
})
</script>

<template>
  <div class="turnstile">
    <div ref="container" aria-label="Security verification" />
    <!-- <p class="turnstile__caption">Protected by Cloudflare Turnstile</p> -->
     <!-- <p class="turnstile__caption"></p> -->
  </div>
</template>

<style scoped>
.turnstile {
  display: grid;
  width: 100%;
  min-height: 4.5rem;
  place-items: center;
  gap: var(--space-2xs);
}

.turnstile__caption {
  margin: 0;
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-caption);
  line-height: var(--line-height-body);
  text-align: center;
}
</style>
