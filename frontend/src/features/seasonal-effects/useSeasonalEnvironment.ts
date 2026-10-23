import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useSeasonalEnvironment() {
  const mobile = ref(false)
  // Start motionless until browser preferences have been read.
  const reducedMotion = ref(true)
  const hidden = ref(true)
  const overlayOpen = ref(false)
  let smallScreen: MediaQueryList | undefined
  let motion: MediaQueryList | undefined
  let observer: MutationObserver | undefined

  function updatePreferences() {
    mobile.value = smallScreen?.matches ?? false
    reducedMotion.value = motion?.matches ?? true
    hidden.value = document.hidden
  }

  function updateOverlay() {
    overlayOpen.value = Boolean(document.querySelector('dialog[open], [aria-modal="true"]')) ||
      ['hidden', 'clip'].includes(document.body.style.overflow) ||
      ['hidden', 'clip'].includes(document.body.style.overflowY)
  }

  onMounted(() => {
    smallScreen = window.matchMedia('(max-width: 47.99rem)')
    motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    smallScreen.addEventListener('change', updatePreferences)
    motion.addEventListener('change', updatePreferences)
    document.addEventListener('visibilitychange', updatePreferences)
    observer = new MutationObserver(updateOverlay)
    observer.observe(document.body, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['open', 'aria-modal', 'style'],
    })
    updatePreferences()
    updateOverlay()
  })

  onBeforeUnmount(() => {
    smallScreen?.removeEventListener('change', updatePreferences)
    motion?.removeEventListener('change', updatePreferences)
    document.removeEventListener('visibilitychange', updatePreferences)
    observer?.disconnect()
  })

  return { mobile, reducedMotion, hidden, overlayOpen }
}
