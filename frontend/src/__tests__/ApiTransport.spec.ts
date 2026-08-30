import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminRequest, apiFetch, fetchAllCursorPages, readJson } from '@/shared/api/http'
import { session } from './fixtures/domain'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('API transport', () => {
  it('preserves status and the server error detail', async () => {
    await expect(
      readJson(new Response(JSON.stringify({ detail: 'Not allowed' }), { status: 403 }), 'Failure'),
    ).rejects.toMatchObject({ status: 403, message: 'Not allowed' })
  })
  it('handles empty success responses and lets the browser set multipart boundaries', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const body = new FormData()
    body.append('file', new Blob(['fixture']), 'fixture.txt')
    await expect(
      adminRequest('/fixture', session, { method: 'POST', body }),
    ).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer fixture-token',
    })
  })
  it('propagates cancellation and bounds a stalled request', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
          }),
      ),
    )
    const controller = new AbortController()
    const cancelled = apiFetch('http://localhost/fixture', { signal: controller.signal }).catch(
      (error: unknown) => error,
    )
    controller.abort()
    expect(await cancelled).toMatchObject({ name: 'AbortError' })
    const timedOut = apiFetch('http://localhost/fixture').catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(await timedOut).toMatchObject({ name: 'TimeoutError' })
  })
  it('stops a malformed pagination loop instead of endlessly fetching', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [], hasMore: true, nextCursor: 'same-cursor' })),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      fetchAllCursorPages(new URL('http://localhost/fixture'), {}, 'Failure'),
    ).rejects.toThrow('repeated cursor')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
