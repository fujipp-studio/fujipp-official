import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '@/stores'
import { i18n } from '@/i18n'
import { fetchAdminWorks, type AdminWork } from '@/features/work/api'
import AdminTools from '@/features/admin/components/AdminTools.vue'
import { session, user } from './fixtures/domain'
import { adminWork } from '../../e2e/fixtures/adminWorks'

vi.mock('@/features/work/api', () => ({ fetchAdminWorks: vi.fn<typeof fetchAdminWorks>() }))

let wrapper: VueWrapper
beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  useAuthStore().session = session
  useAuthStore().currentUser = { ...user, role: 'ADMIN' }
  i18n.global.locale.value = 'en'
  HTMLDialogElement.prototype.showModal = vi.fn<(this: HTMLDialogElement) => void>(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn<(this: HTMLDialogElement) => void>(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
})
afterEach(() => wrapper?.unmount())

async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/work/:id/edit', name: 'work-edit', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  wrapper = mount(AdminTools, { attachTo: document.body, global: { plugins: [router, i18n] } })
  await flushPromises()
  await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
  await flushPromises()
  await wrapper.findAll('nav button')[1]!.trigger('click')
  await flushPromises()
}
async function pickWorks() {
  await wrapper.findAll('button').find(button => button.text().startsWith('Edit project'))!.trigger('click')
  await flushPromises()
}

describe('Admin tools project loading', () => {
  it('ignores an old response after switching away and opening a new project picker', async () => {
    let resolveOld!: (works: AdminWork[]) => void
    vi.mocked(fetchAdminWorks)
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce([{ ...adminWork, slug: 'new-project', translations: [] }])
    await setup()
    await pickWorks()
    await wrapper.findAll('nav button')[0]!.trigger('click')
    await wrapper.findAll('nav button')[1]!.trigger('click')
    await pickWorks()
    expect(wrapper.text()).toContain('new-project')
    resolveOld([adminWork])
    await flushPromises()
    expect(wrapper.text()).toContain('new-project')
    expect(wrapper.text()).not.toContain('Support Bot')
  })

  it('drops pending results and hides tools after the admin session is lost', async () => {
    let resolve!: (works: AdminWork[]) => void
    vi.mocked(fetchAdminWorks).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    await setup()
    await pickWorks()
    useAuthStore().session = null
    await flushPromises()
    resolve([adminWork])
    await flushPromises()
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Support Bot')
  })

  it('distinguishes an empty project list from an API failure', async () => {
    vi.mocked(fetchAdminWorks).mockResolvedValueOnce([])
    await setup()
    await pickWorks()
    expect(wrapper.get('[role="status"]').text()).toContain('No projects yet')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
