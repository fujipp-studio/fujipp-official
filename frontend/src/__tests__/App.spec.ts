import { describe, it, expect } from 'vitest'

import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import { i18n } from '../i18n'

describe('App', () => {
  it(
    'renders the component catalog route',
    async () => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          {
            path: '/components',
            component: () => import('../views/DesignSystemView.vue'),
          },
        ],
      })

      await router.push('/components')
      await router.isReady()

      const wrapper = mount(App, {
        global: {
          plugins: [createPinia(), router, i18n],
        },
      })

      expect(wrapper.get('h1').text()).toBe('Components')
      expect(wrapper.text()).toContain('AppNavbar')
      expect(wrapper.text()).toContain('AppTurnstile')
    },
    15_000,
  )
})
