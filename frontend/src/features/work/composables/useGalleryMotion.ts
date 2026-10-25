import { onScopeDispose, watch, type Ref } from 'vue'

export function useGalleryMotion(element: Ref<HTMLElement | undefined>) {
  const slideDuration = 700
  let frame: number | undefined
  let target = 0
  let restoreSnap: (() => void) | undefined
  let wheelDirection = 0
  let lastWheelAt = -Infinity
  let wheelDistance = 0
  let wheelOrigin = 0
  let wheelProjection = 0
  let wheelPeak = 0
  let gliding = false
  let glidePosition = 0
  let glideVelocity = 0
  let glideTime = 0

  function clearWheel() {
    wheelDirection = 0
    lastWheelAt = -Infinity
    wheelDistance = 0
    wheelOrigin = 0
    wheelProjection = 0
    wheelPeak = 0
  }

  function suspendSnap(gallery: HTMLElement) {
    if (restoreSnap) return
    const snapType = gallery.style.scrollSnapType
    gallery.style.scrollSnapType = 'none'
    restoreSnap = () => {
      gallery.style.scrollSnapType = snapType
    }
  }

  function cancelFrame() {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    gliding = false
    glideVelocity = 0
  }

  function cancel() {
    clearWheel()
    stopAnimation()
  }

  function onPointerDown(event: PointerEvent) {
    clearWheel()
    // Clicking a card between snap points must not shift it under the cursor.
    if (event.pointerType === 'mouse') cancelFrame()
    else {
      stopAnimation()
      // Hybrid laptops can have both a trackpad and a touchscreen.
      element.value?.style.setProperty('scroll-snap-type', 'x mandatory')
    }
  }

  function stopAnimation() {
    cancelFrame()
    restoreSnap?.()
    restoreSnap = undefined
  }

  function destination(direction?: -1 | 1) {
    const current = element.value?.scrollLeft ?? 0
    if (frame === undefined) return current
    // Reversing follows the visible card, even if several forward clicks are queued.
    return direction && direction * (target - current) < 0 ? current : target
  }

  function scrollTo(left: number) {
    clearWheel()
    animateTo(left, slideDuration, (progress) =>
      progress < 0.5 ? 2 * progress ** 2 : 1 - (-2 * progress + 2) ** 2 / 2,
    )
  }

  function animateTo(left: number, duration: number, ease: (progress: number) => number) {
    const gallery = element.value
    if (!gallery) return

    // Retarget without restoring snapping: doing so re-snaps the browser to a
    // card boundary before the reverse animation can read its starting position.
    cancelFrame()
    target = Math.max(0, Math.min(left, gallery.scrollWidth - gallery.clientWidth))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gallery.scrollLeft = target
      stopAnimation()
      return
    }

    const start = gallery.scrollLeft
    const distance = target - start
    if (Math.abs(distance) <= 0.5) {
      stopAnimation()
      return
    }

    // Let the animation reach a card boundary before native snapping takes over.
    suspendSnap(gallery)

    const startedAt = performance.now()
    const advance = (time: number) => {
      const progress = Math.min(1, Math.max(0, (time - startedAt) / duration))
      // Calculate from the original position: browsers can round scrollLeft on every write.
      // Feeding that rounded value back into easing can stall and then jump at the end.
      gallery.scrollLeft = start + distance * ease(progress)
      if (progress === 1) {
        stopAnimation()
        return
      }
      frame = requestAnimationFrame(advance)
    }
    frame = requestAnimationFrame(advance)
  }

  function cardStops(gallery: HTMLElement) {
    const maximum = Math.max(0, gallery.scrollWidth - gallery.clientWidth)
    const clamp = (left: number) => Math.max(0, Math.min(left, maximum))
    const cards = Array.from(gallery.querySelectorAll<HTMLElement>('.work-card'))
    const first = cards[0]?.offsetLeft ?? 0
    return [...new Set([0, ...cards.map((card) => clamp(card.offsetLeft - first)), maximum])].sort(
      (a, b) => a - b,
    )
  }

  function glideTo(left: number) {
    const gallery = element.value
    if (!gallery) return
    target = Math.max(0, Math.min(left, gallery.scrollWidth - gallery.clientWidth))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gallery.scrollLeft = target
      stopAnimation()
      return
    }
    if (gliding) {
      // Extending the landing point retains velocity; reversing follows the new
      // direction immediately without jumping to another position first.
      if ((target - glidePosition) * glideVelocity < 0) glideVelocity = 0
      return
    }
    if (Math.abs(target - gallery.scrollLeft) <= 0.5) return
    cancelFrame()
    suspendSnap(gallery)
    gliding = true
    glidePosition = gallery.scrollLeft
    glideTime = performance.now()
    const advance = (time: number) => {
      const elapsed = Math.max(0, time - glideTime) / 1000
      glideTime = time
      // Analytic critically damped motion carries momentum through multiple
      // cards, eases into its landing, and is independent of display refresh rate.
      const frequency = 14
      const distance = glidePosition - target
      const momentum = glideVelocity + frequency * distance
      const decay = Math.exp(-frequency * elapsed)
      glidePosition = target + (distance + momentum * elapsed) * decay
      glideVelocity = (glideVelocity - frequency * momentum * elapsed) * decay
      gallery.scrollLeft = glidePosition
      if (Math.abs(target - glidePosition) < 0.5 && Math.abs(glideVelocity) < 6) {
        gallery.scrollLeft = target
        stopAnimation()
        return
      }
      frame = requestAnimationFrame(advance)
    }
    frame = requestAnimationFrame(advance)
  }

  function onWheel(event: WheelEvent) {
    const gallery = element.value
    if (
      !gallery ||
      event.ctrlKey ||
      event.metaKey ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    )
      return
    const now = performance.now()
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0)
    const continuing = wheelDirection !== 0 && now - lastWheelAt <= 160
    // Browsers may make later packets in an already-owned trackpad gesture
    // non-cancelable; keep measuring their momentum rather than dropping it.
    if (!event.cancelable && !continuing) return
    if (!delta || (!horizontal && !event.shiftKey && !continuing)) return

    const direction = delta > 0 ? 1 : -1
    const unit = event.deltaMode === 2 ? gallery.clientWidth : event.deltaMode === 1 ? 16 : 1
    const magnitude = Math.abs(delta) * unit
    const sustainedInput =
      frame === undefined && wheelDistance >= 6 && magnitude >= 6 && magnitude >= wheelPeak * 0.7
    const newGesture = direction !== wheelDirection || !continuing || sustainedInput
    const elapsed = newGesture ? 16 : Math.max(8, now - lastWheelAt)
    if (newGesture) {
      wheelDistance = 0
      wheelProjection = 0
      wheelPeak = 0
      wheelOrigin = destination(direction)
    }
    wheelDirection = direction
    lastWheelAt = now
    wheelPeak = Math.max(wheelPeak, magnitude)

    const stops = cardStops(gallery)
    const next =
      direction === 1
        ? stops.find((stop) => stop > wheelOrigin + 1)
        : stops
            .slice()
            .reverse()
            .find((stop) => stop < wheelOrigin - 1)
    if (next === undefined && frame === undefined) return
    // The gesture supplies intent and momentum; native wheel movement must not
    // be added on top of the animation that is already carrying the cards.
    if (event.cancelable) event.preventDefault()
    if (next === undefined) return
    // A declining trackpad tail carries the existing glide; it must not keep
    // accumulating travel and move the landing by another card near the end.
    const activeStroke = magnitude >= wheelPeak * 0.7
    if (activeStroke) wheelDistance += magnitude
    if (wheelDistance < 6) return

    // A light swipe always lands on the adjacent card. Greater distance or speed
    // projects a farther card, while the same glide continues without stopping.
    if (activeStroke)
      wheelProjection = Math.max(wheelProjection, wheelDistance * 1.1, (magnitude / elapsed) * 60)
    const projected =
      wheelOrigin + direction * Math.max(Math.abs(next - wheelOrigin), wheelProjection)
    const landing = stops.reduce(
      (nearest, stop) =>
        Math.abs(stop - projected) < Math.abs(nearest - projected) ? stop : nearest,
      next,
    )
    glideTo(landing)
  }

  watch(element, cancel, { flush: 'sync' })
  onScopeDispose(cancel)

  return { cancel, destination, scrollTo, onWheel, onPointerDown }
}
