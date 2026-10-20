import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminUsersView from '@/features/admin/views/AdminUsersView.vue'
import * as api from '@/features/admin/api/users'
import { fetchAdminFeatures } from '@/features/admin/api/features'
import { useAuthStore } from '@/stores'
import { i18n } from '@/i18n'
import { session, user } from './fixtures/domain'
import { adminUserFeatures, featureOwner } from './fixtures/adminUserFeatures'

vi.mock('@/features/admin/api/users', () => ({
  fetchAdminUsersPage: vi.fn<typeof api.fetchAdminUsersPage>(),
  fetchAdminUserFeatures: vi.fn<typeof api.fetchAdminUserFeatures>(),
  removeAdminUserFeature: vi.fn<typeof api.removeAdminUserFeature>(),
  updateAdminUserFeature: vi.fn<typeof api.updateAdminUserFeature>(),
  grantAdminUserFeature: vi.fn<typeof api.grantAdminUserFeature>(),
  fetchUserWalletHistory: vi.fn<typeof api.fetchUserWalletHistory>(),
  updateAdminUser: vi.fn<typeof api.updateAdminUser>(),
  adjustUserWallet: vi.fn<typeof api.adjustUserWallet>(),
}))
vi.mock('@/features/admin/api/features', () => ({
  fetchAdminFeatures: vi.fn<typeof fetchAdminFeatures>(),
}))
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.session = session
  auth.currentUser = user
  auth.initialized = true
  i18n.global.locale.value = 'en'
  HTMLDialogElement.prototype.showModal = vi.fn<() => void>(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn<() => void>(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  vi.mocked(api.fetchAdminUsersPage).mockResolvedValue({
    items: [featureOwner],
    nextCursor: null,
    hasMore: false,
  })
  vi.mocked(api.fetchAdminUserFeatures).mockResolvedValue(adminUserFeatures())
  vi.mocked(fetchAdminFeatures).mockResolvedValue([])
  vi.mocked(api.removeAdminUserFeature).mockResolvedValue()
})
async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin', component: { template: '<div />' } },
      { path: '/admin/users', component: AdminUsersView },
    ],
  })
  await router.push('/admin/users')
  const wrapper = mount(AdminUsersView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  await wrapper.get('button[aria-label="User features"]').trigger('click')
  await flushPromises()
  const button = (text: string) => wrapper.findAll('button').find((b) => b.text() === text)!
  return { wrapper, button }
}
describe('admin user feature removal', () => {
  it('requires confirmation, supports cancellation, and removes only the selected license', async () => {
    const licenses = adminUserFeatures()
    licenses.push({ ...licenses[0]!, id: 'another-review-license' })
    vi.mocked(api.fetchAdminUserFeatures).mockResolvedValue(licenses)
    const { wrapper, button } = await setup()
    await wrapper
      .get('[data-license-id="review-license"] button[aria-label="Remove Review Credit from user"]')
      .trigger('click')
    expect(api.removeAdminUserFeature).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Feature owner’s inventory')
    expect(wrapper.text()).toContain('Installed bots: 1')
    await button('Cancel').trigger('click')
    expect(api.removeAdminUserFeature).not.toHaveBeenCalled()
    await wrapper
      .get('[data-license-id="review-license"] button[aria-label="Remove Review Credit from user"]')
      .trigger('click')
    await button('Confirm removal').trigger('click')
    await flushPromises()
    expect(api.removeAdminUserFeature).toHaveBeenCalledExactlyOnceWith(
      user.id,
      'review-license',
      expect.objectContaining({ access_token: session.access_token }),
    )
    expect(wrapper.find('[data-license-id="review-license"]').exists()).toBe(false)
    expect(wrapper.find('[data-license-id="another-review-license"]').exists()).toBe(true)
    expect(wrapper.find('[data-license-id="unused-core-license"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('keeps failed removal available for retry and blocks duplicate submissions while pending', async () => {
    const { wrapper, button } = await setup()
    await wrapper.get('button[aria-label="Remove Review Credit from user"]').trigger('click')
    let reject!: (reason: Error) => void
    vi.mocked(api.removeAdminUserFeature).mockImplementationOnce(
      () =>
        new Promise((_, failure) => {
          reject = failure
        }),
    )
    await button('Confirm removal').trigger('click')
    expect(button('Cancel').attributes('disabled')).toBeDefined()
    await button('Confirm removal').trigger('click')
    expect(api.removeAdminUserFeature).toHaveBeenCalledTimes(1)
    reject(new Error('Removal failed'))
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Removal failed')
    await button('Confirm removal').trigger('click')
    await flushPromises()
    expect(api.removeAdminUserFeature).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-license-id="review-license"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('protects installed core features but allows unused core inventory to be removed', async () => {
    const { wrapper } = await setup()
    expect(
      wrapper.get('button[aria-label="Remove Bot Permissions from user"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.get('button[aria-label="Remove Bot Presence from user"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.text()).toContain('Installed core features are required')
    wrapper.unmount()
  })
  it('reports inventory loading errors inside the feature dialog', async () => {
    vi.mocked(api.fetchAdminUserFeatures).mockRejectedValue(new Error('Inventory unavailable'))
    const { wrapper } = await setup()
    expect(wrapper.get('[role="alert"]').text()).toBe('Inventory unavailable')
    expect(wrapper.findAll('[data-license-id]')).toHaveLength(0)
    wrapper.unmount()
  })
  it('ignores an older inventory response after closing and reopening the same user', async () => {
    let complete!: (licenses: api.AdminFeatureLicense[]) => void
    vi.mocked(api.fetchAdminUserFeatures).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const { wrapper, button } = await setup()
    await button('Close').trigger('click')
    await wrapper.get('button[aria-label="User features"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Review Credit')
    complete([{ ...adminUserFeatures()[0]!, featureName: 'Outdated feature' }])
    await flushPromises()
    expect(wrapper.text()).toContain('Review Credit')
    expect(wrapper.text()).not.toContain('Outdated feature')
    wrapper.unmount()
  })
})
