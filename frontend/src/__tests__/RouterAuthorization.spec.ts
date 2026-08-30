import { createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRouter } from '@/router'
import { useAuthStore } from '@/stores'
import { session, user } from './fixtures/domain'
beforeEach(() => {
  setActivePinia(createPinia())
  useAuthStore().initialized = true
  vi.stubGlobal('scrollTo', vi.fn())
})
describe('route authorization and admin layout', () => {
  it('redirects guests away from private routes while preserving Thai locale', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/admin/users?locale=th')
    expect(router.currentRoute.value.name).toBe('home')
    expect(router.currentRoute.value.query.locale).toBe('th')
  })
  it('denies admin access to a normal signed-in user', async () => {
    const auth = useAuthStore()
    auth.session = session
    auth.currentUser = { ...user, role: 'USER' }
    const router = createAppRouter(createMemoryHistory())
    await router.push('/admin/bots')
    expect(router.currentRoute.value.name).toBe('home')
  })
  it('matches nested admin pages and retains the old feature redirect', async () => {
    const auth = useAuthStore()
    auth.session = session
    auth.currentUser = user
    const router = createAppRouter(createMemoryHistory())
    for (const [path, name] of [
      ['/admin', 'admin-dashboard'],
      ['/admin/users', 'admin-users'],
      ['/admin/feature', 'admin-packages'],
      ['/admin/runtime', 'admin-runtime'],
      ['/admin/bots', 'admin-bots'],
    ]) {
      await router.push(path!)
      expect(router.currentRoute.value.name).toBe(name)
      expect(router.currentRoute.value.matched).toHaveLength(2)
      expect(router.currentRoute.value.meta.roles).toEqual(['ADMIN'])
    }
  })
})
