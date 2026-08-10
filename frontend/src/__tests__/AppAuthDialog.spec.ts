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
  it('keeps email sign in actionable while security verification is pending', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    const signIn = vi.spyOn(authStore, 'signIn').mockResolvedValue({ success: true })
    const wrapper = mount(AppAuthDialog, {
      props: { open: true, mode: 'login' },
      global: {
        plugins: [pinia],
        stubs: { Teleport: true },
      },
      attachTo: document.body,
    })

    await wrapper.get('input[type="email"]').setValue('user@example.com')
    await wrapper.get('input[type="password"]').setValue('password123')

    const submitButton = wrapper.get('button[type="submit"]')
    expect(submitButton.attributes('disabled')).toBeUndefined()
    await wrapper.find('form').trigger('submit')
    expect(signIn).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Please complete the security verification')

    wrapper.findComponent(AppTurnstile).vm.$emit('verify', 'captcha-test-token')
    await wrapper.find('form').trigger('submit')
    expect(signIn).toHaveBeenCalledWith('user@example.com', 'password123', 'captcha-test-token')
  })

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
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[type="submit"]').text()).toContain('Email sent')

    await wrapper.find('form').trigger('submit')
    expect(signUp).toHaveBeenCalledTimes(1)
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

    expect(githubButton?.attributes('disabled')).toBeUndefined()
    await githubButton?.trigger('click')
    expect(signInWithOAuth).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Please complete the security verification')

    wrapper.findComponent(AppTurnstile).vm.$emit('verify', 'captcha-oauth-token')
    await wrapper.vm.$nextTick()

    await githubButton?.trigger('click')

    expect(signInWithOAuth).toHaveBeenCalledWith('github')
  })
})
