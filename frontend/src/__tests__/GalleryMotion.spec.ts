import { effectScope, shallowRef } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useGalleryMotion } from '@/features/work/composables/useGalleryMotion'

let time = 0
let nextId = 0
let reducedMotion = false
const frames = new Map<number, FrameRequestCallback>()
const scopes: ReturnType<typeof effectScope>[] = []

function advance(milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 16) {
    time += 16
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(time))
  }
}

function gallery() {
  const element = shallowRef({ scrollLeft: 0, scrollWidth: 1500, clientWidth: 1000 } as HTMLElement)
  const scope = effectScope()
  const motion = scope.run(() => useGalleryMotion(element))!
  scopes.push(scope)
  return { element, motion, scope }
}

const wheel = (options: WheelEventInit) => new WheelEvent('wheel', { cancelable: true, ...options })

beforeEach(() => {
  time = 0
  nextId = 0
  reducedMotion = false
  frames.clear()
  vi.spyOn(performance, 'now').mockImplementation(() => time)
  vi.stubGlobal('matchMedia', () => ({ matches: reducedMotion }))
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
})

it('eases horizontal input and accumulates new input without jumping', () => {
  const { element, motion } = gallery()
  const first = wheel({ deltaX: 100 })
  motion.onWheel(first)
  expect(first.defaultPrevented).toBe(true)
  expect(element.value.scrollLeft).toBe(0)
  advance(16)
  expect(element.value.scrollLeft).toBeGreaterThan(0)
  expect(element.value.scrollLeft).toBeLessThan(100)
  motion.onWheel(wheel({ deltaX: 100 }))
  advance(800)
  expect(element.value.scrollLeft).toBe(200)
  expect(frames.size).toBe(0)
})

it('leaves vertical scrolling and pinch zoom to the browser', () => {
  const { motion } = gallery()
  for (const event of [wheel({ deltaY: 100 }), wheel({ deltaX: 100, ctrlKey: true })]) {
    motion.onWheel(event)
    expect(event.defaultPrevented).toBe(false)
  }
  expect(frames.size).toBe(0)
})

it('clamps at the edge so reversing a gesture responds immediately', () => {
  const { element, motion } = gallery()
  motion.onWheel(wheel({ deltaX: 2000 }))
  motion.onWheel(wheel({ deltaX: -100 }))
  advance(800)
  expect(element.value.scrollLeft).toBe(400)
  motion.scrollTo(-100)
  advance(800)
  expect(element.value.scrollLeft).toBe(0)
})

it('respects reduced motion without scheduling animation', () => {
  reducedMotion = true
  const { element, motion } = gallery()
  motion.scrollTo(300)
  expect(element.value.scrollLeft).toBe(300)
  expect(frames.size).toBe(0)
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
  element.value = { scrollLeft: 0, scrollWidth: 1500, clientWidth: 1000 } as HTMLElement
  expect(frames.size).toBe(0)
  motion.scrollTo(400)
  scope.stop()
  expect(frames.size).toBe(0)
})
