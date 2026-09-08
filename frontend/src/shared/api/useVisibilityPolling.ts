import { onScopeDispose } from 'vue'

/** One request at a time; the next interval starts after completion. */
export function useVisibilityPolling(
  task: (signal: AbortSignal) => Promise<void>,
  interval = 3000,
) {
  let started = false
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Promise<void> | undefined
  let controller: AbortController | undefined

  function schedule() {
    clearTimeout(timer)
    if (started && !disposed && !document.hidden && !pending)
      timer = setTimeout(() => void run(), interval)
  }

  async function run() {
    clearTimeout(timer)
    if (!started || disposed || document.hidden || pending) return
    const request = new AbortController()
    controller = request
    pending = Promise.resolve()
      .then(() => task(request.signal))
      .catch(() => {
        // Background failures retain the last result and retry on the next interval.
      })
    try {
      await pending
    } finally {
      pending = undefined
      controller = undefined
      schedule()
    }
  }

  function start() {
    if (disposed || started) return
    started = true
    schedule()
  }

  function stop() {
    started = false
    clearTimeout(timer)
    controller?.abort()
  }

  function visibilityChanged() {
    if (document.hidden) {
      clearTimeout(timer)
      controller?.abort()
    } else void run()
  }

  document.addEventListener('visibilitychange', visibilityChanged)
  onScopeDispose(() => {
    disposed = true
    stop()
    document.removeEventListener('visibilitychange', visibilityChanged)
  })

  return { start, stop }
}
