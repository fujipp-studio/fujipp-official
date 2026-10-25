import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type Lenis from 'lenis'

export function useDesktopSmoothScroll() {
  const router = useRouter()
  let scroller: Lenis | undefined
  let frame: number | undefined
  let desktop: MediaQueryList | undefined
  let reducedMotion: MediaQueryList | undefined
  let bodyObserver: MutationObserver | undefined
  let removeRouteGuard: (() => void) | undefined
  let loading = false
  let disposed = false

  function shouldSmooth() {
    const { overflow, overflowY } = document.body.style
    return (
      desktop?.matches &&
      !reducedMotion?.matches &&
      !document.hidden &&
      ![overflow, overflowY].some((value) => value === 'hidden' || value === 'clip')
    )
  }

  function cancelFrame() {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
  }

  function advance(time: number) {
    frame = undefined
    if (!scroller || scroller.isScrolling !== 'smooth') return
    scroller.raf(time)
    if (scroller.isScrolling === 'smooth') frame = requestAnimationFrame(advance)
  }

  function requestFrame() {
    if (!scroller || frame !== undefined) return
    // An idle interval must not become a large first animation step.
    scroller.time = 0
    frame = requestAnimationFrame(advance)
  }

  function stopMomentum() {
    cancelFrame()
    if (scroller?.isScrolling === 'smooth') {
      scroller.stop()
      scroller.start()
    }
  }

  function destroy() {
    cancelFrame()
    scroller?.destroy()
    scroller = undefined
  }

  async function update() {
    if (!shouldSmooth()) {
      destroy()
      return
    }
    if (scroller || loading || disposed) return
    loading = true
    try {
      const { default: Lenis } = await import('lenis')
      if (disposed || !shouldSmooth()) return
      scroller = new Lenis({
        autoRaf: false,
        lerp: 0.18,
        smoothWheel: true,
        syncTouch: false,
        allowNestedScroll: true,
        // Keep horizontal gestures, pinch zoom and touch scrolling native.
        virtualScroll: ({ event, deltaX, deltaY }) => {
          if (
            event
              .composedPath()
              .some(
                (node) =>
                  node instanceof HTMLElement && node.hasAttribute('data-native-wheel'),
              )
          ) {
            stopMomentum()
            return false
          }
          return (
            event.type === 'wheel' &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            Math.abs(deltaY) > Math.abs(deltaX)
          )
        },
        prevent: (node) =>
          node.matches(
            'dialog, [role="dialog"], [role="listbox"], input, textarea, select, [contenteditable="true"]',
          ),
      })
      scroller.on('virtual-scroll', requestFrame)
    } catch {
      // A failed optional chunk leaves native scrolling available.
    } finally {
      loading = false
    }
  }

  onMounted(() => {
    if (typeof window.matchMedia !== 'function') return
    desktop = window.matchMedia('(hover: hover) and (pointer: fine)')
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    desktop.addEventListener('change', update)
    reducedMotion.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    // Cancel inertia before links, section controls, keys or scroll-rail dragging take over.
    window.addEventListener('pointerdown', stopMomentum, { capture: true, passive: true })
    window.addEventListener('touchstart', stopMomentum, { capture: true, passive: true })
    window.addEventListener('keydown', stopMomentum, true)
    removeRouteGuard = router.beforeEach(stopMomentum)
    bodyObserver = new MutationObserver(update)
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['style'] })
    void update()
  })

  onBeforeUnmount(() => {
    disposed = true
    destroy()
    desktop?.removeEventListener('change', update)
    reducedMotion?.removeEventListener('change', update)
    document.removeEventListener('visibilitychange', update)
    window.removeEventListener('pointerdown', stopMomentum, true)
    window.removeEventListener('touchstart', stopMomentum, true)
    window.removeEventListener('keydown', stopMomentum, true)
    removeRouteGuard?.()
    bodyObserver?.disconnect()
  })
}
