import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useAuthStore } from '@/stores/auth'
import { fetchCurrentUser } from '@/features/auth/api'
import { impersonationContext, bindSessionContext } from '@/features/auth/impersonation'
import { apiFetch, authenticatedHeaders, backendUrl, readJson } from '@/shared/api/http'
import { deferred, session, user } from './fixtures/domain'

const sdk = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ data: { session: Session }; error: null }>>(),
  onAuthStateChange: vi.fn<
    (callback: (event: AuthChangeEvent, next: Session | null) => void) => {
      data: { subscription: { unsubscribe: () => void } }
    }
  >(),
  updateUser: vi.fn<(input: { password: string }) => Promise<{ error: null }>>(),
  resetPasswordForEmail:
    vi.fn<(email: string, options: { redirectTo: string }) => Promise<{ error: null }>>(),
}))
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ auth: sdk }) }))
vi.mock('@/features/auth/api', () => ({ fetchCurrentUser: vi.fn<typeof fetchCurrentUser>() }))
const target = {
  ...user,
  id: 'target-user',
  role: 'USER' as const,
  email: 'target@example.invalid',
}
const admin = { ...user, role: 'ADMIN' as const }
let listener: (event: AuthChangeEvent, next: Session | null) => void
let auth: ReturnType<typeof useAuthStore> | undefined

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  impersonationContext.value = null
  setActivePinia(createPinia())
  sdk.getSession.mockResolvedValue({ data: { session }, error: null })
  sdk.onAuthStateChange.mockImplementation((callback) => {
    listener = callback
    return { data: { subscription: { unsubscribe: vi.fn<() => void>() } } }
  })
  vi.mocked(fetchCurrentUser).mockImplementation(async () =>
    impersonationContext.value ? target : admin,
  )
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      return Response.json({
        token: 'opaque-capability',
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
        user: target,
      })
    }),
  )
})
afterEach(() => {
  auth?.$dispose()
  auth = undefined
  impersonationContext.value = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
async function act() {
  auth = useAuthStore()
  await auth.initialize()
  await auth.beginImpersonation(target.id)
  return auth
}

describe('impersonation lifecycle', () => {
  it('cancels a request already pending before the first impersonation starts', async () => {
    auth = useAuthStore()
    await auth.initialize()
    const pendingResponse = deferred<Response>()
    vi.mocked(fetch).mockReturnValueOnce(pendingResponse.promise)
    const pending = apiFetch(`${backendUrl}/api/v1/bots`, {
      headers: authenticatedHeaders(auth.session!),
    }).then(
      () => null,
      (cause: unknown) => cause,
    )
    await auth.beginImpersonation(target.id)
    pendingResponse.resolve(Response.json({ private: 'administrator data' }))
    expect(await pending).toMatchObject({ name: 'AbortError' })
  })

  it('uses the target identity with the actor credential, survives refresh, and restores admin on exit', async () => {
    const auth = await act()
    expect(auth.currentUser).toEqual(target)
    expect(auth.session?.user.id).toBe(target.id)
    expect(auth.session?.user.email).toBe(target.email)
    expect(auth.session?.access_token).toBe(session.access_token)
    expect(auth.session?.user.user_metadata).toEqual({})
    listener('TOKEN_REFRESHED', { ...session, access_token: 'refreshed-token' })
    await flushPromises()
    expect(auth.currentUser?.id).toBe(target.id)
    expect(auth.impersonation?.token).toBe('opaque-capability')
    await auth.endImpersonation()
    expect(auth.currentUser?.role).toBe('ADMIN')
    expect(auth.session?.user.id).toBe(session.user.id)
    expect(auth.impersonation).toBeNull()
    const deletion = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'DELETE')!
    expect(new Headers(deletion[1]?.headers).get('X-Impersonation-Token')).toBe('opaque-capability')
  })

  it('expires after 15 minutes without retrying any user mutation as admin', async () => {
    const auth = await act()
    await vi.advanceTimersByTimeAsync(900_000)
    expect(auth.impersonation).toBeNull()
    expect(auth.currentUser?.role).toBe('ADMIN')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('blocks changes to Supabase authentication settings and preserves state if revocation fails', async () => {
    const auth = await act()
    expect((await auth.updatePassword('some-password')).success).toBe(false)
    expect((await auth.requestPasswordReset()).success).toBe(false)
    expect(sdk.updateUser).not.toHaveBeenCalled()
    expect(sdk.resetPasswordForEmail).not.toHaveBeenCalled()
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    await expect(auth.endImpersonation()).rejects.toThrow('offline')
    expect(auth.impersonation).not.toBeNull()
    expect(auth.currentUser?.id).toBe(target.id)
  })

  it('discards a pending profile from the previous identity and clears impersonation on sign-out events', async () => {
    auth = useAuthStore()
    await auth.initialize()
    const pending = deferred<typeof admin>()
    vi.mocked(fetchCurrentUser).mockReturnValueOnce(pending.promise)
    const reload = auth.reloadCurrentUser()
    await auth.beginImpersonation(target.id)
    pending.resolve(admin)
    await reload
    expect(auth.currentUser?.id).toBe(target.id)
    listener('SIGNED_OUT', null)
    await flushPromises()
    expect(auth.session).toBeNull()
    expect(auth.impersonation).toBeNull()
    expect(auth.currentUser).toBeNull()
  })
})

describe('impersonation transport boundary', () => {
  it('adds the capability to authenticated backend calls only and refuses stale session snapshots', async () => {
    const previous = bindSessionContext({ ...session })
    await act()
    const effective = auth!.session!
    await apiFetch(`${backendUrl}/api/v1/auth/me`, {
      headers: authenticatedHeaders(auth!.session!),
    })
    const headers = new Headers(vi.mocked(fetch).mock.calls.at(-1)![1]?.headers)
    expect(headers.get('X-Impersonation-Token')).toBe('opaque-capability')
    expect(headers.get('Authorization')).toBe(`Bearer ${session.access_token}`)
    expect(() => authenticatedHeaders(previous)).toThrow('Account changed')
    await apiFetch('https://external.invalid/api/example', {
      headers: { Authorization: 'other-token' },
    })
    expect(
      new Headers(vi.mocked(fetch).mock.calls.at(-1)![1]?.headers).has('X-Impersonation-Token'),
    ).toBe(false)
    await apiFetch(`${backendUrl}/api/v1/runtime/plans`)
    expect(
      new Headers(vi.mocked(fetch).mock.calls.at(-1)![1]?.headers).has('X-Impersonation-Token'),
    ).toBe(false)
    await auth!.endImpersonation()
    expect(() => authenticatedHeaders(previous)).toThrow('Account changed')
    expect(() => authenticatedHeaders(effective)).toThrow('Account changed')
  })

  it('rejects responses from a prior identity even when the underlying request ignores abort', async () => {
    const auth = await act()
    const response = deferred<Response>()
    vi.mocked(fetch).mockReturnValueOnce(response.promise)
    const pending = apiFetch(`${backendUrl}/api/v1/bots`, {
      headers: authenticatedHeaders(auth.session!),
    })
    const result = pending.then(
      () => null,
      (cause: unknown) => cause,
    )
    await auth.endImpersonation()
    response.resolve(Response.json({ items: ['private target data'] }))
    expect(await result).toMatchObject({ name: 'AbortError', message: 'Account changed' })
  })

  it('discards a body that finishes parsing after the impersonated account changes', async () => {
    const auth = await act()
    const body = deferred<unknown>()
    const response = Response.json({})
    vi.spyOn(response, 'json').mockReturnValueOnce(body.promise)
    vi.mocked(fetch).mockResolvedValueOnce(response)
    const received = await apiFetch(`${backendUrl}/api/v1/bots`, {
      headers: authenticatedHeaders(auth.session!),
    })
    const pending = readJson(received, 'Unable to load bots').then(
      () => null,
      (cause: unknown) => cause,
    )
    await auth.endImpersonation()
    body.resolve({ private: 'target data' })
    expect(await pending).toMatchObject({ name: 'AbortError' })
  })

  it('returns a revoked-session error without replaying the request as admin', async () => {
    const auth = await act()
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ reason: 'IMPERSONATION_ENDED' }, { status: 403 }),
    )
    const response = await apiFetch(`${backendUrl}/api/v1/bots`, {
      method: 'POST',
      headers: authenticatedHeaders(auth.session!),
    })
    await flushPromises()
    expect(response.status).toBe(403)
    expect(auth.impersonation).toBeNull()
    expect(auth.currentUser?.role).toBe('ADMIN')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
