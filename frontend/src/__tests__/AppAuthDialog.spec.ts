import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'

import AppAuthDialog from '../shared/ui/dialogs/AppAuthDialog.vue'
import AppTurnstile from '../shared/ui/security/AppTurnstile.vue'
import { useAuthStore } from '../stores'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('AppAuthDialog', () => {
  it('submits an email and password signup', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    const signUp = vi
      .spyOn(authStore, 'signUp')
      .mockResolvedValue({ success: true, requiresEmailConfirmation: true })
    const wrapper = mount(AppAuthDialog, {
      props: { open: true, mode: 'register' },
      global: {
        plugins: [pinia],
        stubs: { Teleport: true },
      },
      attachTo: document.body,
    })
    const inputs = wrapper.findAll('input')

    wrapper.findComponent(AppTurnstile).vm.$emit('verify', 'captcha-test-token')
    await inputs[0]?.setValue('user@example.com')
    await inputs[1]?.setValue('password123')
    await inputs[2]?.setValue('password123')
    await inputs[3]?.setValue(true)
    await wrapper.find('form').trigger('submit')

    expect(signUp).toHaveBeenCalledWith(
      'user@example.com',
      'password123',
      'captcha-test-token',
    )
  })

  it('starts GitHub OAuth from the existing social button', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    const signInWithOAuth = vi
      .spyOn(authStore, 'signInWithOAuth')
      .mockResolvedValue({ success: true })
    const wrapper = mount(AppAuthDialog, {
      props: { open: true, mode: 'login' },
      global: {
        plugins: [pinia],
        stubs: { Teleport: true },
      },
      attachTo: document.body,
    })
    const githubButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'GitHub')

    await githubButton?.trigger('click')

    expect(signInWithOAuth).toHaveBeenCalledWith('github')
  })
})
