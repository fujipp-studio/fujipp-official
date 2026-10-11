import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recognizePriceReaderImage } from '../features/bots/models/price-reader-ocr'

type MockWorker = {
  recognize: (canvas: HTMLCanvasElement) => Promise<{ data: { text: string } }>
  terminate: () => Promise<void>
}

const { createWorker, recognize, terminate } = vi.hoisted(() => ({
  createWorker: vi.fn<(...args: unknown[]) => Promise<MockWorker>>(),
  recognize: vi.fn<MockWorker['recognize']>(),
  terminate: vi.fn<MockWorker['terminate']>(),
}))
vi.mock('tesseract.js', () => ({ createWorker }))

describe('local Price Reader OCR', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'createImageBitmap',
      vi
        .fn<() => Promise<{ width: number; height: number; close: () => void }>>()
        .mockResolvedValue({ width: 800, height: 600, close: vi.fn<() => void>() }),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn<() => void>(),
      drawImage: vi.fn<() => void>(),
    } as unknown as CanvasRenderingContext2D)
    createWorker.mockResolvedValue({ recognize, terminate })
    recognize.mockResolvedValue({ data: { text: 'THB 250.00' } })
    terminate.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    vi.useRealTimers()
  })
  it('reads an image locally and releases its worker', async () => {
    const file = new File(['image'], 'shop.png', { type: 'image/png' })
    expect(
      await recognizePriceReaderImage(file, new AbortController().signal, vi.fn<() => void>()),
    ).toBe('THB 250.00')
    expect(createWorker.mock.calls[0]?.slice(0, 2)).toEqual([['tha', 'eng'], 1])
    expect(recognize.mock.calls[0]?.[0]).toBeInstanceOf(HTMLCanvasElement)
    expect(terminate).toHaveBeenCalledTimes(1)
  })
  it('rejects unsupported files and oversized images before starting OCR', async () => {
    await expect(
      recognizePriceReaderImage(
        new File(['gif'], 'image.gif', { type: 'image/gif' }),
        new AbortController().signal,
        vi.fn<() => void>(),
      ),
    ).rejects.toThrow('Choose')
    const file = new File(['image'], 'shop.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 })
    await expect(
      recognizePriceReaderImage(file, new AbortController().signal, vi.fn<() => void>()),
    ).rejects.toThrow('10 MB')
    expect(createWorker).not.toHaveBeenCalled()
  })
  it('cancels recognition and terminates the active worker', async () => {
    const controller = new AbortController()
    recognize.mockImplementationOnce(() => {
      controller.abort()
      return new Promise(() => {})
    })
    await expect(
      recognizePriceReaderImage(
        new File(['image'], 'shop.png', { type: 'image/png' }),
        controller.signal,
        vi.fn<() => void>(),
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(terminate).toHaveBeenCalledTimes(1)
  })
  it('releases a worker when recognition fails', async () => {
    recognize.mockRejectedValueOnce(new Error('OCR failed'))
    await expect(
      recognizePriceReaderImage(
        new File(['image'], 'shop.png', { type: 'image/png' }),
        new AbortController().signal,
        vi.fn<() => void>(),
      ),
    ).rejects.toThrow('OCR failed')
    expect(terminate).toHaveBeenCalledTimes(1)
  })
})
