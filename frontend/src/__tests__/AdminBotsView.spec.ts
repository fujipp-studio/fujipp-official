import type { Session } from '@supabase/supabase-js'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  controlAdminBot,
  deleteAdminBot,
  fetchAdminBots,
  transferAdminBot,
  type AdminBot,
} from '@/features/admin/api/bots'
import { fetchAdminUsers } from '@/features/admin/api/users'
import AdminBotsView from '@/features/admin/views/AdminBotsView.vue'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores'

vi.mock('@/features/admin/api/bots', () => ({
  fetchAdminBots: vi.fn<() => Promise<AdminBot[]>>(),
  controlAdminBot: vi.fn<typeof controlAdminBot>(),
  deleteAdminBot: vi.fn<() => Promise<void>>(),
  transferAdminBot: vi.fn<typeof transferAdminBot>(),
}))
vi.mock('@/features/admin/api/users', () => ({
  fetchAdminUsers: vi.fn<() => Promise<[]>>(),
}))

const bot: AdminBot = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerUserId: '22222222-2222-4222-8222-222222222222',
  ownerDisplayName: 'Bot Owner',
  name: 'Support Bot',
  status: 'STOPPED',
  desiredState: 'STOPPED',
  createdAt: new Date().toISOString(),
}

describe('AdminBotsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    HTMLDialogElement.prototype.showModal = vi.fn<() => void>(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    })
    HTMLDialogElement.prototype.close = vi.fn<() => void>(function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    })
    vi.mocked(fetchAdminBots).mockResolvedValue([bot])
    vi.mocked(fetchAdminUsers).mockResolvedValue([])
    vi.mocked(deleteAdminBot).mockResolvedValue()

    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().session = { access_token: 'admin-token' } as Session
    i18n.global.locale.value = 'en'
  })

  it('requires confirmation before deleting a bot and removes it from the list', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin', component: { template: '<div />' } },
        { path: '/admin/bots', component: AdminBotsView },
        { path: '/admin/bots/:botId/settings', name: 'admin-bot-settings', component: { template: '<div />' } },
      ],
    })
    await router.push('/admin/bots')
    await router.isReady()

    const wrapper = mount(AdminBotsView, { global: { plugins: [i18n, router] } })
    await flushPromises()

    const deleteButton = wrapper.findAll('button').find((button) => button.text() === 'Delete bot')
    expect(deleteButton).toBeDefined()
    await deleteButton!.trigger('click')
    await flushPromises()

    expect(deleteAdminBot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('This action cannot be undone.')

    const confirmButton = wrapper
      .findAll('button')
      .filter((button) => button.text() === 'Delete bot')
      .at(-1)
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(deleteAdminBot).toHaveBeenCalledWith(
      bot.id,
      expect.objectContaining({ access_token: 'admin-token' }),
    )
    expect(wrapper.text()).not.toContain(bot.name)
    expect(document.body.textContent).toContain('Bot deleted')
    expect(controlAdminBot).not.toHaveBeenCalled()
    expect(transferAdminBot).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
