import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { expect, it } from 'vitest'
import AppButton from '@/shared/ui/buttons/AppButton.vue'

it('uses client navigation while preserving modifier clicks and disabled links', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/work', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  const wrapper = mount(AppButton, {
    props: { to: '/work' },
    slots: { default: 'Work' },
    global: { plugins: [router] },
  })
  expect(wrapper.element.tagName).toBe('A')
  expect(wrapper.attributes('href')).toBe('/work')
  let nativeNavigations = 0
  wrapper.element.addEventListener('click', (event: Event) => {
    if (!event.defaultPrevented) {
      nativeNavigations += 1
      event.preventDefault() // JSDOM cannot open the new tab left to the browser.
    }
  })
  await wrapper.trigger('click', { ctrlKey: true })
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/')
  expect(nativeNavigations).toBe(1)
  await wrapper.setProps({ target: '_blank' })
  await wrapper.trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/')
  expect(nativeNavigations).toBe(2)
  for (const state of [
    { disabled: true, loading: false },
    { disabled: false, loading: true },
  ]) {
    await wrapper.setProps({ ...state, target: undefined })
    expect(wrapper.attributes('href')).toBeUndefined()
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    await wrapper.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  }
  await wrapper.setProps({ disabled: false, loading: false })
  wrapper.element.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true, cancelable: true }))
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/work')
  wrapper.unmount()
})
