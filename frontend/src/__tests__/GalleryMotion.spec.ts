import { effectScope, shallowRef } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useGalleryMotion } from '@/features/work/composables/useGalleryMotion'

let time = 0
let nextId = 0
let reducedMotion = false
let finePointer = true
const frames = new Map<number, FrameRequestCallback>()
const scopes: ReturnType<typeof effectScope>[] = []

function advance(milliseconds: number, frameTime = 16) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += frameTime) {
    time += frameTime
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(time))
  }
}

function gallery(scrollWidth = 1500) {
  const node = document.createElement('section')
  Object.defineProperties(node, {
    scrollWidth: { value: scrollWidth },
    clientWidth: { value: 1000 },
    clientHeight: { value: 600 },
  })
  for (const offsetLeft of [0, 300, 600, 900, 1200, 1500]) {
    const card = document.createElement('li')
    card.className = 'work-card'
    Object.defineProperty(card, 'offsetLeft', { value: offsetLeft })
    node.append(card)
  }
  const element = shallowRef(node)
  const scope = effectScope()
  const motion = scope.run(() => useGalleryMotion(element))!
  scopes.push(scope)
  return { element, motion, scope }
}

beforeEach(() => {
  time = 0
  nextId = 0
  reducedMotion = false
  finePointer = true
  frames.clear()
  vi.spyOn(performance, 'now').mockImplementation(() => time)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : finePointer,
  }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextId, callback)
    return nextId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('eases button navigation and retargets from the current position without jumping', () => {
  const { element, motion } = gallery()
  motion.scrollTo(100)
  expect(element.value.scrollLeft).toBe(0)
  advance(16)
  expect(element.value.scrollLeft).toBeGreaterThan(0)
  expect(element.value.scrollLeft).toBeLessThan(100)
  const current = element.value.scrollLeft
  motion.scrollTo(motion.destination() + 100)
  expect(element.value.scrollLeft).toBe(current)
  advance(720)
  expect(element.value.scrollLeft).toBe(200)
  expect(frames.size).toBe(0)
})

it.each([8, 16, 32])(
  'settles without stalling when the browser rounds pixels at %i ms per frame',
  (frameTime) => {
    const { element, motion } = gallery()
    let position = 0
    const positions: number[] = []
    Object.defineProperty(element.value, 'scrollLeft', {
      get: () => position,
      set: (value: number) => {
        position = Math.round(value)
        positions.push(position)
      },
    })
    motion.scrollTo(400)
    advance(736, frameTime)
    expect(position).toBe(400)
    expect(frames.size).toBe(0)
    expect(positions.every((value, index) => index === 0 || value >= positions[index - 1]!)).toBe(
      true,
    )
    expect(positions.at(-1)! - positions.at(-2)!).toBeLessThanOrEqual(1)
  },
)

it('clamps at the edges and reverses button navigation immediately', () => {
  const { element, motion } = gallery()
  motion.scrollTo(2000)
  expect(motion.destination()).toBe(500)
  advance(160)
  const current = element.value.scrollLeft
  expect(motion.destination(1)).toBe(500)
  expect(motion.destination(-1)).toBe(current)
  motion.scrollTo(-100)
  advance(16)
  expect(element.value.scrollLeft).toBeLessThan(current)
  advance(720)
  expect(element.value.scrollLeft).toBe(0)
})

it('uses the reference gallery’s 700 ms quadratic ease-in-out for arrow navigation', () => {
  const { element, motion } = gallery()
  motion.scrollTo(400)
  advance(350, 10)
  expect(element.value.scrollLeft).toBe(200)
  advance(350, 10)
  expect(element.value.scrollLeft).toBe(400)
  expect(frames.size).toBe(0)
})

it('respects reduced motion without scheduling animation', () => {
  reducedMotion = true
  const { element, motion } = gallery()
  motion.scrollTo(300)
  expect(element.value.scrollLeft).toBe(300)
  expect(frames.size).toBe(0)
})

it('suspends native snapping during button animation and restores it on completion or interruption', () => {
  const { element, motion } = gallery()
  element.value.style.scrollSnapType = 'x mandatory'
  motion.scrollTo(400)
  expect(element.value.style.scrollSnapType).toBe('none')
  advance(720)
  expect(element.value.style.scrollSnapType).toBe('x mandatory')
  motion.scrollTo(0)
  expect(element.value.style.scrollSnapType).toBe('none')
  motion.cancel()
  expect(element.value.style.scrollSnapType).toBe('x mandatory')
})

it('keeps snapping suspended when reversing an unfinished slide', () => {
  const { element, motion } = gallery()
  let snapType = 'x mandatory'
  Object.defineProperty(element.value.style, 'scrollSnapType', {
    get: () => snapType,
    set: (value: string) => {
      snapType = value
      // Model the browser re-snapping when CSS snapping is restored mid-slide.
      if (value !== 'none') element.value.scrollLeft = 0
    },
  })
  motion.scrollTo(400)
  advance(128)
  const before = element.value.scrollLeft
  motion.scrollTo(0)
  expect(element.value.scrollLeft).toBe(before)
  expect(snapType).toBe('none')
  advance(16)
  expect(element.value.scrollLeft).toBeLessThan(before)
  expect(element.value.scrollLeft).toBeGreaterThan(0)
  advance(720)
  expect(element.value.scrollLeft).toBe(0)
  expect(snapType).toBe('x mandatory')
})

it('cancels animation when direct interaction or a gallery replacement takes over', () => {
  const { element, motion, scope } = gallery()
  motion.scrollTo(400)
  advance(16)
  motion.cancel()
  const stoppedAt = element.value.scrollLeft
  advance(800)
  expect(element.value.scrollLeft).toBe(stoppedAt)
  motion.scrollTo(400)
  element.value = {
    scrollLeft: 0,
    scrollWidth: 1500,
    clientWidth: 1000,
    style: { scrollSnapType: '' },
  } as HTMLElement
  expect(frames.size).toBe(0)
  motion.scrollTo(400)
  scope.stop()
  expect(frames.size).toBe(0)
})

it.each([1, -1])(
  'carries a light swipe gently to the adjacent card in direction %i',
  (direction) => {
    const { element, motion } = gallery()
    const start = direction === 1 ? 0 : 300
    const landing = direction === 1 ? 300 : 0
    element.value.scrollLeft = start
    element.value.style.scrollSnapType = 'x mandatory'
    const event = new WheelEvent('wheel', { deltaX: direction * 6, cancelable: true })
    motion.onWheel(event)
    expect(event.defaultPrevented).toBe(true)
    expect(motion.destination()).toBe(landing)
    expect(element.value.scrollLeft).toBe(start)
    advance(160)
    expect(direction * (element.value.scrollLeft - start)).toBeGreaterThan(0)
    expect(direction * (landing - element.value.scrollLeft)).toBeGreaterThan(0)
    advance(1440)
    expect(element.value.scrollLeft).toBe(landing)
    expect(element.value.style.scrollSnapType).toBe('x mandatory')
  },
)

it.each([1, -1])(
  'keeps a moderate swipe and its momentum tail on the adjacent card in direction %i',
  (direction) => {
    const { element, motion } = gallery(2500)
    element.value.scrollLeft = 600
    const landing = 600 + direction * 300
    const positions: number[] = []
    for (const magnitude of [60, 56, 50, 44, 38, 32, 26, 20, 14, 10, 6, 3, 1]) {
      motion.onWheel(new WheelEvent('wheel', { deltaX: direction * magnitude, cancelable: true }))
      expect(motion.destination()).toBe(landing)
      advance(16)
      positions.push(element.value.scrollLeft)
    }
    for (let index = 0; index < 10; index++) {
      advance(80)
      motion.onWheel(new WheelEvent('wheel', { deltaX: direction * 0.5, cancelable: true }))
      expect(motion.destination()).toBe(landing)
      positions.push(element.value.scrollLeft)
    }
    advance(1200)
    expect(element.value.scrollLeft).toBe(landing)
    expect(
      positions.every(
        (position, index) => index === 0 || direction * (position - positions[index - 1]!) >= 0,
      ),
    ).toBe(true)
  },
)

it('chooses farther card stops for stronger swipes and always ends locked', () => {
  const glides = [6, 200, 400].map((delta) => {
    const { element, motion } = gallery(2500)
    motion.onWheel(new WheelEvent('wheel', { deltaX: delta, cancelable: true }))
    return { element, motion, landing: motion.destination() }
  })
  expect(glides[0]!.landing).toBe(300)
  expect(glides[1]!.landing).toBeGreaterThan(glides[0]!.landing)
  expect(glides[1]!.landing).toBeLessThan(1500)
  expect(glides[2]!.landing).toBe(1500)
  advance(1600)
  for (const glide of glides) expect(glide.element.value.scrollLeft).toBe(glide.landing)
  expect(frames.size).toBe(0)
})

it('uses swipe speed as well as distance to choose the landing card', () => {
  const fast = gallery(2500)
  const slow = gallery(2500)
  for (const glide of [fast, slow])
    glide.motion.onWheel(new WheelEvent('wheel', { deltaX: 6, cancelable: true }))
  advance(16)
  fast.motion.onWheel(new WheelEvent('wheel', { deltaX: 160, cancelable: true }))
  advance(64)
  slow.motion.onWheel(new WheelEvent('wheel', { deltaX: 160, cancelable: true }))
  expect(fast.motion.destination()).toBeGreaterThan(slow.motion.destination())
})

it('carries later momentum packets through the active glide without jumping', () => {
  const { element, motion } = gallery(2500)
  const positions: number[] = []
  let position = 0
  Object.defineProperty(element.value, 'scrollLeft', {
    get: () => position,
    set: (value: number) => {
      position = value
      positions.push(value)
    },
  })
  motion.onWheel(new WheelEvent('wheel', { deltaX: 6, cancelable: true }))
  advance(96)
  const before = element.value.scrollLeft
  // WebKit can mark follow-up packets non-cancelable even though the gesture is owned.
  motion.onWheel(new WheelEvent('wheel', { deltaX: 500, cancelable: false }))
  const landing = motion.destination()
  expect(landing).toBeGreaterThan(300)
  expect(element.value.scrollLeft).toBe(before)
  advance(16)
  expect(element.value.scrollLeft).toBeGreaterThan(before)
  expect(element.value.scrollLeft).toBeLessThan(landing)
  advance(1600)
  expect(element.value.scrollLeft).toBe(landing)
  expect(positions.every((value, index) => index === 0 || value >= positions[index - 1]!)).toBe(
    true,
  )
  expect(positions.some((value) => value > 300 && value < landing)).toBe(true)
})

it.each([8, 16, 32])(
  'coasts into the final stop without overshooting at %i ms per frame',
  (frameTime) => {
    const { element, motion } = gallery(2500)
    motion.onWheel(new WheelEvent('wheel', { deltaX: 400, cancelable: true }))
    advance(160, frameTime)
    expect(element.value.scrollLeft).toBeGreaterThan(0)
    expect(element.value.scrollLeft).toBeLessThan(1500)
    advance(1440, frameTime)
    expect(element.value.scrollLeft).toBe(1500)
    expect(frames.size).toBe(0)
  },
)

it('does not turn a decaying momentum tail into another swipe after landing', () => {
  const { element, motion } = gallery(2500)
  motion.onWheel(new WheelEvent('wheel', { deltaX: 120, cancelable: true }))
  const landing = motion.destination()
  for (const deltaX of [8, 6, 4, 3, 2, 1.5, 1, 0.8, 0.5, 0.3, 0.2]) {
    advance(80)
    motion.onWheel(new WheelEvent('wheel', { deltaX, cancelable: true }))
    expect(motion.destination()).toBe(landing)
  }
  advance(1200)
  expect(element.value.scrollLeft).toBe(landing)
})

it('accepts repeated deliberate nudges with a stationary pointer', () => {
  const { element, motion } = gallery(2500)
  motion.onWheel(new WheelEvent('wheel', { deltaX: 6, cancelable: true }))
  for (let index = 0; index < 12; index++) {
    advance(80)
    motion.onWheel(new WheelEvent('wheel', { deltaX: 6, cancelable: true }))
  }
  advance(1600)
  expect(element.value.scrollLeft).toBeGreaterThan(300)
  expect(element.value.scrollLeft % 300).toBe(0)
})

it('reverses immediately from the visible position and locks correctly from a partial last page', () => {
  const { element, motion } = gallery()
  motion.onWheel(new WheelEvent('wheel', { deltaX: 6, cancelable: true }))
  advance(96)
  const before = element.value.scrollLeft
  motion.onWheel(new WheelEvent('wheel', { deltaX: -6, cancelable: true }))
  expect(element.value.scrollLeft).toBe(before)
  expect(motion.destination()).toBe(0)
  advance(1600)
  expect(element.value.scrollLeft).toBe(0)
  motion.cancel()
  element.value.scrollLeft = 500
  motion.onWheel(new WheelEvent('wheel', { deltaX: -6, cancelable: true }))
  expect(motion.destination()).toBe(300)
  advance(1600)
  expect(element.value.scrollLeft).toBe(300)
})

it('honors reduced motion for assisted trackpad swipes too', () => {
  const { element, motion } = gallery()
  reducedMotion = true
  motion.onWheel(new WheelEvent('wheel', { deltaX: 6, cancelable: true }))
  expect(element.value.scrollLeft).toBe(300)
  expect(frames.size).toBe(0)
})

it('stops on direct interaction and restores native touch snapping', () => {
  const { element, motion, scope } = gallery()
  element.value.style.scrollSnapType = 'x mandatory'
  motion.onWheel(new WheelEvent('wheel', { deltaX: 6, cancelable: true }))
  advance(96)
  motion.onPointerDown(new PointerEvent('pointerdown', { pointerType: 'mouse' }))
  const stoppedAt = element.value.scrollLeft
  advance(1600)
  expect(element.value.scrollLeft).toBe(stoppedAt)
  motion.onPointerDown(new PointerEvent('pointerdown', { pointerType: 'touch' }))
  expect(element.value.style.scrollSnapType).toBe('x mandatory')
  motion.onWheel(new WheelEvent('wheel', { deltaX: 6, cancelable: true }))
  scope.stop()
  advance(1600)
  expect(frames.size).toBe(0)
})

it('leaves mobile input, vertical wheel scrolling and pinch zoom native', () => {
  const { element, motion } = gallery()
  finePointer = false
  motion.onWheel(new WheelEvent('wheel', { deltaX: 24 }))
  finePointer = true
  motion.onWheel(new WheelEvent('wheel', { deltaY: 24 }))
  motion.onWheel(new WheelEvent('wheel', { deltaX: 24, ctrlKey: true }))
  expect(element.value.style.scrollSnapType).toBe('')
  expect(frames.size).toBe(0)
})
