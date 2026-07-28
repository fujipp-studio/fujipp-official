import { describe, it, expect } from 'vitest'

import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'

describe('App', () => {
  it(
    'renders the design system route',
    async () => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          {
            path: '/design-system',
            component: () => import('../views/DesignSystemView.vue'),
          },
        ],
      })

      await router.push('/design-system')
      await router.isReady()

      const wrapper = mount(App, {
        global: {
          plugins: [createPinia(), router],
        },
      })

      expect(wrapper.text()).toContain('Navbar')
      expect(wrapper.text()).toContain('Sign in')
    },
    15_000,
  )
})
