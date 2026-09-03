import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useAuthStore } from '@/stores/auth'
import { fetchCurrentUser } from '@/features/auth/api'
import { session, user, deferred } from './fixtures/domain'

const sdk = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ data: { session: Session }; error: null }>>(),
  signInWithPassword: vi.fn<() => Promise<{ data: { session: Session }; error: null }>>(),
  signOut: vi.fn<() => Promise<{ error: null }>>(),
  updateUser: vi.fn<() => Promise<{ error: null }>>(),
  resetPasswordForEmail: vi.fn<() => Promise<{ error: null }>>(),
  onAuthStateChange:
    vi.fn<
      (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
        data: { subscription: { unsubscribe: () => void } }
      }
    >(),
  unsubscribe: vi.fn<() => void>(),
}))
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ auth: sdk }) }))
vi.mock('@/features/auth/api', () => ({ fetchCurrentUser: vi.fn<typeof fetchCurrentUser>() }))
let listener: (event: AuthChangeEvent, value: Session | null) => void
beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  Object.defineProperty(window, 'localStorage', { configurable: true, value: { length: 0 } })
  sdk.onAuthStateChange.mockImplementation((callback) => {
    listener = callback
    return { data: { subscription: { unsubscribe: sdk.unsubscribe } } }
  })
  sdk.getSession.mockResolvedValue({ data: { session }, error: null })
  sdk.signInWithPassword.mockResolvedValue({ data: { session }, error: null })
  sdk.signOut.mockResolvedValue({ error: null })
  sdk.updateUser.mockResolvedValue({ error: null })
  sdk.resetPasswordForEmail.mockResolvedValue({ error: null })
  vi.mocked(fetchCurrentUser).mockResolvedValue(user)
})
describe('authentication session lifecycle', () => {
  it('subscribes after guest login and uses refreshed tokens without reloading', async () => {
    const auth = useAuthStore()
    auth.initializeGuestState()
    expect(sdk.onAuthStateChange).not.toHaveBeenCalled()
    expect((await auth.signIn('test@example.invalid', 'test', 'captcha')).success).toBe(true)
    const refreshed = { ...session, access_token: 'refreshed-fixture-token' }
    listener('TOKEN_REFRESHED', refreshed)
    await flushPromises()
    expect(auth.session?.access_token).toBe(refreshed.access_token)
    expect(fetchCurrentUser).toHaveBeenLastCalledWith(refreshed)
    await auth.signIn('test@example.invalid', 'test', 'captcha')
    expect(sdk.onAuthStateChange).toHaveBeenCalledTimes(1)
    auth.$dispose()
    expect(sdk.unsubscribe).toHaveBeenCalledOnce()
  })
  it('does not restore a stale profile after logout while a request is pending', async () => {
    const auth = useAuthStore()
    await auth.initialize()
    const pending = deferred<typeof user>()
    vi.mocked(fetchCurrentUser).mockReturnValueOnce(pending.promise)
    listener('TOKEN_REFRESHED', { ...session, access_token: 'later-token' })
    await auth.signOut()
    pending.resolve(user)
    await flushPromises()
    expect(auth.currentUser).toBeNull()
    expect(auth.session).toBeNull()
    auth.$dispose()
  })
  it('exposes background profile failures instead of an unhandled rejection', async () => {
    const auth = useAuthStore()
    await auth.initialize()
    vi.mocked(fetchCurrentUser).mockRejectedValueOnce(new Error('Account unavailable'))
    listener('TOKEN_REFRESHED', { ...session, access_token: 'later-token' })
    await flushPromises()
    expect(auth.error).toBe('Account unavailable')
    auth.$dispose()
  })
  it('updates and resets the current password through Supabase Auth', async () => {
    const auth = useAuthStore()
    await auth.initialize()

    expect((await auth.updatePassword('new-password')).success).toBe(true)
    expect(sdk.updateUser).toHaveBeenCalledWith({ password: 'new-password' })

    expect((await auth.requestPasswordReset()).success).toBe(true)
    expect(sdk.resetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.invalid',
      expect.objectContaining({ redirectTo: expect.stringContaining('/auth/callback?recovery=1') }),
    )
  })
})
