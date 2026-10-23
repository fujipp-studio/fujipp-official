import { onScopeDispose, watch, type Ref } from 'vue'

export function useGalleryMotion(element: Ref<HTMLElement | undefined>) {
  let frame: number | undefined
  let target = 0
  let lastTime = 0
  let settleBy = 0

  function cancel() {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
  }

  function destination() {
    return frame === undefined ? (element.value?.scrollLeft ?? 0) : target
  }

  function scrollTo(left: number) {
    const gallery = element.value
    if (!gallery) return

    target = Math.max(0, Math.min(left, gallery.scrollWidth - gallery.clientWidth))
    settleBy = performance.now() + 600
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cancel()
      gallery.scrollLeft = target
      return
    }
    if (frame !== undefined) return

    lastTime = performance.now()
    const advance = (time: number) => {
      const distance = target - gallery.scrollLeft
      if (Math.abs(distance) <= 0.5 || time >= settleBy) {
        gallery.scrollLeft = target
        frame = undefined
        return
      }

      // Use elapsed time so trackpads feel the same on 60 Hz and 120 Hz displays.
      const elapsed = Math.max(0, time - lastTime)
      lastTime = time
      gallery.scrollLeft += distance * (1 - Math.exp(-elapsed / 80))
      frame = requestAnimationFrame(advance)
    }
    frame = requestAnimationFrame(advance)
  }

  function onWheel(event: WheelEvent) {
    const gallery = element.value
    if (!gallery || event.ctrlKey || event.metaKey || !event.cancelable) return

    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    if (!horizontal && !event.shiftKey) return

    const delta = horizontal ? event.deltaX : event.deltaY
    if (!delta) return

    const unit = event.deltaMode === 2 ? gallery.clientWidth : event.deltaMode === 1 ? 16 : 1
    event.preventDefault()
    event.stopPropagation()
    scrollTo(destination() + delta * unit)
  }

  watch(element, cancel, { flush: 'sync' })
  onScopeDispose(cancel)

  return { cancel, destination, onWheel, scrollTo }
}
