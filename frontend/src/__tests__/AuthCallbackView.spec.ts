import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../stores'
import AuthCallbackView from '../views/AuthCallbackView.vue'

describe('AuthCallbackView', () => {
  it.each([
    ['/auth/callback', '/'],
    ['/auth/callback?returnTo=/support&locale=th', '/support?locale=th'],
    ['/auth/callback?returnTo=https://example.com', '/'],
  ])('returns from %s to %s after authentication', async (callback, expected) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    vi.spyOn(authStore, 'completeOAuthCallback').mockResolvedValue({ success: true })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<main>Home</main>' } },
        { path: '/auth/callback', component: AuthCallbackView },
        { path: '/support', component: { template: '<main>Support</main>' } },
      ],
    })
    await router.push(callback)
    await router.isReady()

    mount(AuthCallbackView, {
      global: {
        plugins: [pinia, router],
        stubs: { DesignSystemView: true },
      },
    })
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe(expected)
  })
})
