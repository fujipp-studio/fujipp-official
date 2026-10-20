import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAnimationVisibility } from '../shared/ui/useAnimationVisibility'

describe('visible animation lifecycle', () => {
  let wrapper: VueWrapper | undefined
  let intersect: (visible: boolean) => void
  let hidden: boolean
  let motion: EventTarget & { matches: boolean }
  const disconnect = vi.fn<() => void>()

  beforeEach(() => {
    hidden = false
    motion = Object.assign(new EventTarget(), { matches: false })
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    vi.stubGlobal('matchMedia', vi.fn(() => motion))
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = (visible) => callback(
          [{ isIntersecting: visible } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        )
      }
      observe = vi.fn<() => void>()
      disconnect = disconnect
    })
    disconnect.mockClear()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function mountAnimation() {
    const changed = vi.fn<(active: boolean) => void>()
    wrapper = mount(defineComponent({
      setup() {
        const target = ref<HTMLElement>()
        useAnimationVisibility(target, changed)
        return () => h('div', { ref: target })
      },
    }))
    return changed
  }

  it('runs only in view and pauses when the tab becomes hidden', () => {
    const changed = mountAnimation()
    expect(changed).not.toHaveBeenCalledWith(true)
    intersect(true)
    expect(changed).toHaveBeenLastCalledWith(true)
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    expect(changed).toHaveBeenLastCalledWith(false)
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    expect(changed).toHaveBeenLastCalledWith(true)
    intersect(false)
    expect(changed).toHaveBeenLastCalledWith(false)
  })

  it('honors motion preference changes without restarting an offscreen animation', () => {
    const changed = mountAnimation()
    motion.matches = true
    intersect(true)
    expect(changed).toHaveBeenLastCalledWith(false)
    motion.matches = false
    motion.dispatchEvent(new Event('change'))
    expect(changed).toHaveBeenLastCalledWith(true)
    intersect(false)
    motion.dispatchEvent(new Event('change'))
    expect(changed).toHaveBeenLastCalledWith(false)
  })

  it('stops frames and removes visibility listeners on unmount', () => {
    const changed = mountAnimation()
    intersect(true)
    wrapper?.unmount()
    wrapper = undefined
    expect(disconnect).toHaveBeenCalledOnce()
    expect(changed).toHaveBeenLastCalledWith(false)
    changed.mockClear()
    document.dispatchEvent(new Event('visibilitychange'))
    motion.dispatchEvent(new Event('change'))
    expect(changed).not.toHaveBeenCalled()
  })

  it('still pauses for hidden tabs when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const changed = mountAnimation()
    expect(changed).toHaveBeenLastCalledWith(true)
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    expect(changed).toHaveBeenLastCalledWith(false)
  })
})
