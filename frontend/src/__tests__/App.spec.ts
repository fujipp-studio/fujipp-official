import { describe, it, expect } from 'vitest'

import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import { i18n } from '../i18n'

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
          plugins: [createPinia(), router, i18n],
        },
      })

      expect(wrapper.text()).toContain('Navbar')
      expect(wrapper.text()).toContain('Authentication: Off')
    },
    15_000,
  )
})
