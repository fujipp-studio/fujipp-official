import { onBeforeUnmount, onMounted, type Ref } from 'vue'

// Decorative animations only need frames while they can actually be seen.
export function useAnimationVisibility(
  target: Ref<HTMLElement | undefined>,
  onChange: (active: boolean) => void,
) {
  let observer: IntersectionObserver | undefined
  let motionPreference: MediaQueryList | undefined
  let inViewport = false

  function update() {
    onChange(inViewport && !document.hidden && !motionPreference?.matches)
  }

  onMounted(() => {
    motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    motionPreference.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)

    if (target.value && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(([entry]) => {
        inViewport = entry?.isIntersecting ?? false
        update()
      })
      observer.observe(target.value)
    } else {
      inViewport = true
      update()
    }
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    motionPreference?.removeEventListener('change', update)
    document.removeEventListener('visibilitychange', update)
    onChange(false)
  })
}
