import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePdfCaptureActions } from '@features/pdf/capture/usePdfCaptureActions'

const mocks = vi.hoisted(() => ({
  renderPageToImageFallback: vi.fn(),
  findPageCanvas: vi.fn<() => HTMLCanvasElement | null>(() => null),
  showError: vi.fn()
}))
const { renderPageToImageFallback } = mocks
const queueImageForAi = vi.fn()
const revokeObjectURL = vi.fn()

vi.mock('@app/providers', () => ({
  useToastActions: () => ({ showError: mocks.showError })
}))

vi.mock('@features/pdf/capture/findPageCanvas', () => ({
  findPageCanvas: mocks.findPageCanvas
}))

vi.mock('@features/pdf/lib/renderPageToImage', () => ({
  renderPageToImageFallback: mocks.renderPageToImageFallback
}))

describe('usePdfCaptureActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('drops and revokes a render that finishes after the PDF changes', async () => {
    let resolveRender:
      | ((value: { blob: Blob; blobUrl: string; width: number; height: number }) => void)
      | undefined
    renderPageToImageFallback.mockReturnValue(
      new Promise((resolve) => {
        resolveRender = resolve
      })
    )

    const { result, rerender } = renderHook(
      ({ pdfUrl }) =>
        usePdfCaptureActions({
          currentPage: 1,
          queueImageForAi,
          startScreenshot: vi.fn(),
          pdfUrl
        }),
      { initialProps: { pdfUrl: 'blob:old-pdf' } }
    )

    let capturePromise: Promise<void> | undefined
    act(() => {
      capturePromise = result.current.handleFullPageScreenshot()
    })
    rerender({ pdfUrl: 'blob:new-pdf' })

    await act(async () => {
      resolveRender?.({
        blob: new Blob(['stale']),
        blobUrl: 'blob:stale-render',
        width: 1,
        height: 1
      })
      await capturePromise
    })

    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stale-render')
  })
})

/**
 * The capture ladder is what keeps a screenshot request from dead-ending.
 *
 * The order production actually uses is:
 *
 *   1. a high-DPI render straight from the PDF engine (scale 4.0, 20 MP)
 *   2. the live viewer canvas, as a synchronous data url
 *   3. the same canvas found after a progressive retry ladder (~900 ms total),
 *      because a page may not be rasterized yet on a large or slow document
 *   4. a low-resolution direct render (scale 2) as a last resort
 *   5. an error toast
 *
 * Rungs 2 and 3 share the canvas path; only the number of lookups differs. Every
 * rung below the first has to be reachable, otherwise a busy document silently
 * loses its screenshot.
 */
describe('usePdfCaptureActions fallback ladder', () => {
  const queueImageForAi = vi.fn()
  const startScreenshot = vi.fn()
  const PDF_URL = 'blob:pdf-under-test'

  type Rendered = { blob: Blob; blobUrl: string; width: number; height: number }

  function rendered(overrides: Partial<Rendered> = {}): Rendered {
    return {
      blob: new Blob(['page'], { type: 'image/png' }),
      blobUrl: 'blob:rendered-page',
      width: 100,
      height: 100,
      ...overrides
    }
  }

  function makeCanvas(width = 400, height = 200) {
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'width', { configurable: true, value: width })
    Object.defineProperty(canvas, 'height', { configurable: true, value: height })
    return canvas
  }

  function mountHook(pdfUrl: string | null = PDF_URL) {
    return renderHook(() =>
      usePdfCaptureActions({ currentPage: 4, queueImageForAi, startScreenshot, pdfUrl })
    )
  }

  let dataUrlCalls: { mime: string | undefined; quality: unknown }[]
  let createObjectURL: ReturnType<typeof vi.fn>

  /**
   * Drain enough of the queue for a capture to reach its next await.
   *
   * `renderPageToImageFallback` is behind a dynamic `import()`, so this needs more
   * than a microtask tick or two.
   */
  async function settle(): Promise<void> {
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    dataUrlCalls = []
    mocks.renderPageToImageFallback.mockReset()
    mocks.findPageCanvas.mockReset()
    mocks.findPageCanvas.mockReturnValue(null)
    mocks.showError.mockReset()
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL }))
    createObjectURL = vi.fn(() => 'blob:canvas-blob')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      configurable: true,
      writable: true,
      value: (mime?: string, quality?: unknown) => {
        dataUrlCalls.push({ mime, quality })
        return 'data:image/png;base64,ENCODED'
      }
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      writable: true,
      value: (callback: BlobCallback, type?: string) =>
        callback(new Blob(['canvas'], { type: type ?? 'image/png' }))
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('rung 1 — direct high-DPI render', () => {
    it('queues the render as a data url and revokes its object url', async () => {
      mocks.renderPageToImageFallback.mockResolvedValue(rendered())
      const { result } = mountHook()

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(mocks.renderPageToImageFallback).toHaveBeenCalledTimes(1)
      expect(mocks.renderPageToImageFallback).toHaveBeenCalledWith(PDF_URL, 4, {
        scale: 4.0,
        maxPixels: 20_000_000
      })
      expect(queueImageForAi).toHaveBeenCalledTimes(1)
      expect(queueImageForAi.mock.calls[0][0]).toMatch(/^data:image\//)
      expect(queueImageForAi).toHaveBeenCalledWith(expect.any(String), {
        page: 4,
        captureKind: 'full-page'
      })
      // The intermediate blob url must not leak once the data url is queued.
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:rendered-page')
    })

    it('queues the object url itself when the blob cannot be read as a data url', async () => {
      vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (
        this: FileReader
      ) {
        this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>)
      })
      mocks.renderPageToImageFallback.mockResolvedValue(rendered())
      const { result } = mountHook()

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(queueImageForAi).toHaveBeenCalledWith('blob:rendered-page', {
        page: 4,
        captureKind: 'full-page'
      })
      // The blob url now belongs to the AI queue, so it is not revoked.
      expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:rendered-page')
    })

    it('does not run the direct render when no pdf url is available', async () => {
      mocks.findPageCanvas.mockReturnValue(makeCanvas())
      const { result } = mountHook(null)

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(mocks.renderPageToImageFallback).not.toHaveBeenCalled()
      expect(queueImageForAi).toHaveBeenCalledTimes(1)
    })

    it('falls through to the viewer canvas when the render returns null', async () => {
      mocks.renderPageToImageFallback.mockResolvedValue(null)
      mocks.findPageCanvas.mockReturnValue(makeCanvas())
      const { result } = mountHook()

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(queueImageForAi).toHaveBeenCalledWith('data:image/png;base64,ENCODED', {
        page: 4,
        captureKind: 'full-page'
      })
    })

    it('falls through to the viewer canvas when the render throws', async () => {
      mocks.renderPageToImageFallback.mockRejectedValue(new Error('render boom'))
      mocks.findPageCanvas.mockReturnValue(makeCanvas())
      const { result } = mountHook()

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(queueImageForAi).toHaveBeenCalledTimes(1)
      expect(mocks.showError).not.toHaveBeenCalled()
    })
  })

  describe('rung 2 — live viewer canvas', () => {
    it('prefers a synchronous data url over a blob url', async () => {
      mocks.renderPageToImageFallback.mockResolvedValue(null)
      mocks.findPageCanvas.mockReturnValue(makeCanvas())
      const { result } = mountHook()

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(createObjectURL).not.toHaveBeenCalled()
      expect(queueImageForAi).toHaveBeenCalledWith('data:image/png;base64,ENCODED', {
        page: 4,
        captureKind: 'full-page'
      })
    })

    it('asks for JPEG when the on-screen canvas exceeds the 12 MP guard', async () => {
      // Same 12 MP threshold captureCanvasAsBlob applies, duplicated inline here.
      // The guard exists so a HiDPI page does not serialise as a huge PNG.
      mocks.renderPageToImageFallback.mockResolvedValue(null)
      mocks.findPageCanvas.mockReturnValue(makeCanvas(4000, 4000))
      const { result } = mountHook()

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(dataUrlCalls).toEqual([{ mime: 'image/jpeg', quality: 0.95 }])
    })

    it('keeps PNG for a canvas just below the 12 MP guard', async () => {
      mocks.renderPageToImageFallback.mockResolvedValue(null)
      mocks.findPageCanvas.mockReturnValue(makeCanvas(3000, 3999))
      const { result } = mountHook()

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(dataUrlCalls).toEqual([{ mime: 'image/png', quality: undefined }])
    })

    it('falls back to a blob url when the data url is unusable', async () => {
      Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
        configurable: true,
        writable: true,
        value: () => 'data:,'
      })
      mocks.renderPageToImageFallback.mockResolvedValue(null)
      mocks.findPageCanvas.mockReturnValue(makeCanvas())
      const { result } = mountHook()

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(queueImageForAi).toHaveBeenCalledWith('blob:canvas-blob', {
        page: 4,
        captureKind: 'full-page'
      })
    })
  })

  describe('rung 3 — progressive retry for an unrasterized page', () => {
    it('retries the canvas lookup and succeeds on a later attempt', async () => {
      vi.useFakeTimers()
      try {
        mocks.renderPageToImageFallback.mockResolvedValue(null)
        mocks.findPageCanvas
          .mockReturnValueOnce(null)
          .mockReturnValueOnce(null)
          .mockReturnValue(makeCanvas())
        const { result } = mountHook()

        let capture: Promise<void> | undefined
        act(() => {
          capture = result.current.handleFullPageScreenshot()
        })
        await act(async () => {
          await vi.advanceTimersByTimeAsync(200)
        })
        await act(async () => {
          await capture
        })

        // One initial lookup plus two retry misses before the canvas appeared.
        expect(mocks.findPageCanvas).toHaveBeenCalledTimes(3)
        expect(queueImageForAi).toHaveBeenCalledWith('data:image/png;base64,ENCODED', {
          page: 4,
          captureKind: 'full-page'
        })
      } finally {
        vi.useRealTimers()
      }
    })

    it('gives up after the whole ladder instead of retrying forever', async () => {
      vi.useFakeTimers()
      try {
        mocks.renderPageToImageFallback.mockResolvedValue(null)
        mocks.findPageCanvas.mockReturnValue(null)
        const { result } = mountHook(null)

        let capture: Promise<void> | undefined
        act(() => {
          capture = result.current.handleFullPageScreenshot()
        })
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000)
        })
        await act(async () => {
          await capture
        })

        // 1 initial lookup + 10 retries.
        expect(mocks.findPageCanvas).toHaveBeenCalledTimes(11)
        expect(queueImageForAi).not.toHaveBeenCalled()
        expect(mocks.showError).toHaveBeenCalledWith('toast_capture_failed')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('rung 4 — last-resort low-resolution render', () => {
    it('renders again at scale 2 when no canvas ever appeared', async () => {
      vi.useFakeTimers()
      try {
        mocks.renderPageToImageFallback
          .mockResolvedValueOnce(null) // rung 1, high DPI
          .mockResolvedValueOnce(rendered({ blobUrl: 'blob:last-resort' })) // rung 4
        mocks.findPageCanvas.mockReturnValue(null)
        const { result } = mountHook()

        let capture: Promise<void> | undefined
        act(() => {
          capture = result.current.handleFullPageScreenshot()
        })
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000)
        })
        await act(async () => {
          await capture
        })

        expect(mocks.renderPageToImageFallback).toHaveBeenNthCalledWith(1, PDF_URL, 4, {
          scale: 4.0,
          maxPixels: 20_000_000
        })
        expect(mocks.renderPageToImageFallback).toHaveBeenNthCalledWith(2, PDF_URL, 4, {
          scale: 2
        })
        expect(queueImageForAi).toHaveBeenCalledWith('blob:last-resort', {
          page: 4,
          captureKind: 'full-page'
        })
        expect(mocks.showError).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('shows the toast when the last-resort render also fails', async () => {
      vi.useFakeTimers()
      try {
        mocks.renderPageToImageFallback.mockResolvedValue(null)
        mocks.findPageCanvas.mockReturnValue(null)
        const { result } = mountHook()

        let capture: Promise<void> | undefined
        act(() => {
          capture = result.current.handleFullPageScreenshot()
        })
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000)
        })
        await act(async () => {
          await capture
        })

        expect(queueImageForAi).not.toHaveBeenCalled()
        expect(mocks.showError).toHaveBeenCalledWith('toast_capture_failed')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('canvas serialization failure', () => {
    it('shows the toast when both the data url and the blob fail', async () => {
      Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
        configurable: true,
        writable: true,
        value: () => {
          throw new Error('dataUrl boom')
        }
      })
      Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
        configurable: true,
        writable: true,
        value: () => {
          throw new Error('blob boom')
        }
      })
      mocks.renderPageToImageFallback.mockResolvedValue(null)
      mocks.findPageCanvas.mockReturnValue(makeCanvas())
      const { result } = mountHook()

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(queueImageForAi).not.toHaveBeenCalled()
      expect(mocks.showError).toHaveBeenCalledWith('toast_capture_failed')
    })

    it('shows the toast when the blob serializer reports failure instead of a blob', async () => {
      // captureCanvasAsBlob rejects on a null blob. Capture must not hang and
      // must not queue an undefined url.
      Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
        configurable: true,
        writable: true,
        value: () => 'data:,'
      })
      Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
        configurable: true,
        writable: true,
        value: (callback: BlobCallback) => callback(null)
      })
      mocks.renderPageToImageFallback.mockResolvedValue(null)
      mocks.findPageCanvas.mockReturnValue(makeCanvas())
      const { result } = mountHook()

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(queueImageForAi).not.toHaveBeenCalled()
      expect(createObjectURL).not.toHaveBeenCalled()
      expect(mocks.showError).toHaveBeenCalledWith('toast_capture_failed')
    })

    it('stays silent when a superseded request fails after a newer one took over', async () => {
      // Supersession has to cover the failure toast, not just the queue: a
      // double-clicked capture whose blob serializer reports failure on the way out
      // would otherwise raise "capture failed" next to the image its successor just
      // queued. Only the current request may complain.
      mocks.renderPageToImageFallback.mockResolvedValue(null)
      mocks.findPageCanvas.mockImplementation(() => makeCanvas())
      Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
        configurable: true,
        writable: true,
        value: () => 'data:,'
      })
      // Held, not answered, so the first request is still in flight when the second
      // one starts and supersedes it.
      const blobCallbacks: BlobCallback[] = []
      Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
        configurable: true,
        writable: true,
        value: (callback: BlobCallback) => {
          blobCallbacks.push(callback)
        }
      })
      const { result } = mountHook()

      let first!: Promise<unknown>
      await act(async () => {
        first = result.current.handleFullPageScreenshot()
        await settle()
      })
      expect(blobCallbacks).toHaveLength(1)

      await act(async () => {
        const second = result.current.handleFullPageScreenshot()
        await settle()
        // The successor succeeds; the superseded one then fails.
        blobCallbacks[1](new Blob(['ok'], { type: 'image/png' }))
        await second
        blobCallbacks[0](null)
        await first
      })

      expect(queueImageForAi).toHaveBeenCalledTimes(1)
      expect(mocks.showError).not.toHaveBeenCalled()
    })
  })

  describe('canvas released by GPU cleanup mid-capture', () => {
    it('re-looks up the page when the discovered canvas was zeroed', async () => {
      mocks.renderPageToImageFallback.mockResolvedValue(null)
      mocks.findPageCanvas.mockReturnValueOnce(makeCanvas(0, 0)).mockReturnValue(makeCanvas())
      const { result } = mountHook()

      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(mocks.findPageCanvas).toHaveBeenCalledTimes(2)
      expect(queueImageForAi).toHaveBeenCalledWith('data:image/png;base64,ENCODED', {
        page: 4,
        captureKind: 'full-page'
      })
    })

    it('shows the toast when the canvas stays zeroed', async () => {
      mocks.renderPageToImageFallback.mockResolvedValue(null)
      mocks.findPageCanvas.mockReturnValue(makeCanvas(0, 0))
      const { result } = mountHook(null)

      // The canvas is found on the first lookup, so this never enters the retry
      // ladder: the re-validation happens immediately.
      await act(async () => {
        await result.current.handleFullPageScreenshot()
      })

      expect(queueImageForAi).not.toHaveBeenCalled()
      expect(mocks.showError).toHaveBeenCalledWith('toast_capture_failed')
    })
  })

  // The area path never touches PDF.js: it hands the main process a screen
  // rectangle. It still has to carry the page the reader is on, or the crop is
  // filed against the wrong page.
  describe('handleAreaScreenshot', () => {
    it('forwards the live page to the main process and queues nothing itself', () => {
      const { result } = renderHook(() =>
        usePdfCaptureActions({ currentPage: 7, queueImageForAi, startScreenshot, pdfUrl: PDF_URL })
      )

      act(() => {
        result.current.handleAreaScreenshot()
      })

      expect(startScreenshot).toHaveBeenCalledTimes(1)
      expect(startScreenshot).toHaveBeenCalledWith({ page: 7, captureKind: 'selection' })
      expect(queueImageForAi).not.toHaveBeenCalled()
    })
  })
})
