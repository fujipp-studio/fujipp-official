import { effectScope } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useVisibilityPolling } from '@/shared/api/useVisibilityPolling'
import { deferred } from './fixtures/domain'

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'hidden', { value: false, configurable: true })
})
afterEach(() => vi.useRealTimers())

it('never overlaps slow polls and schedules the next request after completion', async () => {
  const pending = deferred<void>()
  const task = vi
    .fn<(signal: AbortSignal) => Promise<void>>()
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue(undefined)
  const scope = effectScope()
  scope.run(() => useVisibilityPolling(task).start())
  await vi.advanceTimersByTimeAsync(12000)
  expect(task).toHaveBeenCalledTimes(1)
  pending.resolve()
  await vi.advanceTimersByTimeAsync(2999)
  expect(task).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(task).toHaveBeenCalledTimes(2)
  scope.stop()
})

it('aborts hidden/disposed requests, resumes on visibility, and cannot restart after disposal', async () => {
  const signals: AbortSignal[] = []
  const task = vi.fn<(signal: AbortSignal) => Promise<void>>(async (signal: AbortSignal) => {
    signals.push(signal)
  })
  const scope = effectScope()
  const polling = scope.run(() => useVisibilityPolling(task))!
  polling.start()
  Object.defineProperty(document, 'hidden', { value: true, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(9000)
  expect(task).not.toHaveBeenCalled()
  Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(0)
  expect(task).toHaveBeenCalledTimes(1)
  const pending = deferred<void>()
  task.mockImplementationOnce(async (signal) => {
    signals.push(signal)
    await pending.promise
  })
  await vi.advanceTimersByTimeAsync(3000)
  scope.stop()
  expect(signals.at(-1)?.aborted).toBe(true)
  pending.resolve()
  polling.start()
  await vi.advanceTimersByTimeAsync(9000)
  expect(task).toHaveBeenCalledTimes(2)
})
