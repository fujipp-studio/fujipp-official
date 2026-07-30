import { computed, onBeforeUnmount, onMounted, ref, type CSSProperties, type Ref } from 'vue'

type ScrollFadeMode = 'both' | 'enter' | 'exit'

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function useScrollFade(element: Ref<HTMLElement | undefined>, mode: ScrollFadeMode) {
  const progress = ref(mode === 'exit' ? 1 : 0)
  let animationFrame: number | undefined

  function update() {
    animationFrame = undefined
    const target = element.value
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      progress.value = 1
      return
    }

    const rect = target.getBoundingClientRect()
    const viewportHeight = window.innerHeight

    const enterProgress = clamp((viewportHeight - rect.top) / (viewportHeight * 0.3))
    const exitProgress = clamp(
      (rect.bottom - viewportHeight * 0.2) / (viewportHeight * 0.55),
    )

    if (mode === 'enter') progress.value = enterProgress
    else if (mode === 'exit') progress.value = exitProgress
    else progress.value = Math.min(enterProgress, exitProgress)
  }

  function requestUpdate() {
    if (animationFrame === undefined) animationFrame = window.requestAnimationFrame(update)
  }

  const style = computed<CSSProperties>(() => ({
    opacity: progress.value,
  }))

  onMounted(() => {
    update()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', requestUpdate)
    window.removeEventListener('resize', requestUpdate)
    if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
  })

  return style
}
