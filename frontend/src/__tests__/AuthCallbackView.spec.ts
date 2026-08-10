import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../stores'
import AuthCallbackView from '../views/AuthCallbackView.vue'

describe('AuthCallbackView', () => {
  it('returns to the home page after authentication succeeds', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    vi.spyOn(authStore, 'completeOAuthCallback').mockResolvedValue({ success: true })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<main>Home</main>' } },
        { path: '/auth/callback', component: AuthCallbackView },
      ],
    })
    await router.push('/auth/callback')
    await router.isReady()

    mount(AuthCallbackView, {
      global: {
        plugins: [pinia, router],
        stubs: { DesignSystemView: true },
      },
    })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/')
  })
})
