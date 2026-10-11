import type { Worker } from 'tesseract.js'
import workerUrl from 'tesseract.js/dist/worker.min.js?url'

/** Local rehearsal only: files are never uploaded. Bot preprocessing uses Sharp. */
export async function recognizePriceReaderImage(
  file: File,
  signal: AbortSignal,
  progress: (value: number) => void,
): Promise<string> {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error('Choose a PNG, JPEG or WebP image up to 10 MB.')
  signal.throwIfAborted()
  const bitmap = await createImageBitmap(file)
  let canvas: HTMLCanvasElement
  try {
    if (bitmap.width * bitmap.height > 24_000_000)
      throw new Error('Image dimensions are too large.')
    const scale = Math.min(
      3,
      1800 / Math.min(bitmap.width, bitmap.height),
      Math.sqrt(24_000_000 / (bitmap.width * bitmap.height)),
    )
    canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * Math.max(1, scale))
    canvas.height = Math.round(bitmap.height * Math.max(1, scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image processing is unavailable.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.filter = 'grayscale(1) contrast(1.15)'
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  } finally {
    bitmap.close()
  }
  const { createWorker } = await import('tesseract.js')
  signal.throwIfAborted()
  let worker: Worker | undefined
  let released = false
  async function release(created: Worker) {
    if (released) return
    released = true
    await created.terminate()
  }
  const initializing = createWorker(['tha', 'eng'], 1, {
    workerPath: workerUrl,
    workerBlobURL: false,
    logger: (event) => {
      if (event.status === 'recognizing text') progress(Math.round(event.progress * 100))
    },
    errorHandler: () => {},
  })
  // Creation may still be downloading language files when the user cancels.
  void initializing.then(
    (created) => {
      if (signal.aborted) void release(created)
    },
    () => {},
  )
  let timeout: ReturnType<typeof setTimeout> | undefined
  let abort: (() => void) | undefined
  try {
    const interrupted = new Promise<never>((_, reject) => {
      abort = () => reject(new DOMException('Cancelled', 'AbortError'))
      signal.addEventListener('abort', abort, { once: true })
      timeout = setTimeout(() => reject(new Error('OCR timed out.')), 90_000)
    })
    worker = await Promise.race([initializing, interrupted])
    signal.throwIfAborted()
    const result = await Promise.race([worker.recognize(canvas), interrupted])
    return result.data.text
  } finally {
    clearTimeout(timeout)
    if (abort) signal.removeEventListener('abort', abort)
    // Also dispose of workers that finish initialization after a timeout.
    if (worker) await release(worker)
    else void initializing.then(release, () => {})
  }
}
