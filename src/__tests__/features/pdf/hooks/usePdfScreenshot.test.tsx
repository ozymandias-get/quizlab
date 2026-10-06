/**
 * `usePdfCaptureActions` — the 5-rung capture ladder, driven through its hook.
 *
 * The DOM fixtures below are the native viewer's markup: a `[data-native-pdf-page]`
 * page box wrapping a `[data-native-pdf-canvas]` canvas. They used to build
 * `rpv-core__page-layer` / `data-virtual-index` markup, which asserted the ladder's
 * *encoder* behaviour (dataUrl preferred, blob fallback, toast on double failure)
 * rather than the viewer's private class names. The ladder is unchanged; only the
 * fixtures moved.
 *
 * The direct high-DPI render and the two AI/crop handlers are covered end-to-end in
 * `native/nativeCaptureActions.test.tsx`, which drives the real controller.
 */
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const showError = vi.fn()
vi.mock('@app/providers', () => ({
  useToastActions: () => ({ showError })
}))

// Import after mock is registered
const { usePdfCaptureActions } = await import('@features/pdf/capture/usePdfCaptureActions')

/** A mounted native page, as `NativePdfViewer` renders it. */
function mountNativePage(pageNumber: number, width = 400, height = 200): HTMLCanvasElement {
  const box = document.createElement('div')
  box.setAttribute('data-native-pdf-page', String(pageNumber))
  const canvas = document.createElement('canvas')
  canvas.setAttribute('data-native-pdf-canvas', '')
  Object.defineProperty(canvas, 'width', { configurable: true, value: width })
  Object.defineProperty(canvas, 'height', { configurable: true, value: height })
  box.appendChild(canvas)
  document.body.appendChild(box)
  return canvas
}

describe('usePdfCaptureActions', () => {
  const queueImageForAi = vi.fn()
  const startScreenshot = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      configurable: true,
      value: () => 'data:image/png;base64,mockScreenshotData'
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: (callback: BlobCallback, type?: string) => {
        const mockBlob = new Blob(['mockBlobData'], { type: type || 'image/png' })
        callback(mockBlob)
      }
    })
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('captures the canvas for the page it is told about', async () => {
    // The single-canvas viewer mounts exactly one page box, so the page number in
    // the call has to be the one the box carries; a mismatch is exactly the bug
    // that would send page 1 to the AI while the reader is on page 40.
    mountNativePage(13, 420, 210)

    const { result } = renderHook(() =>
      usePdfCaptureActions({
        currentPage: 13,
        queueImageForAi,
        startScreenshot
      })
    )

    await result.current.handleFullPageScreenshot()

    expect(queueImageForAi).toHaveBeenCalledTimes(1)
    // Prefer dataUrl path (avoids blob fetch round-trip)
    expect(queueImageForAi).toHaveBeenCalledWith('data:image/png;base64,mockScreenshotData', {
      page: 13,
      captureKind: 'full-page'
    })
  })

  it('does not queue an image but shows the toast when no canvas is found after retries', async () => {
    const { result } = renderHook(() =>
      usePdfCaptureActions({
        currentPage: 1,
        queueImageForAi,
        startScreenshot
      })
    )

    await result.current.handleFullPageScreenshot()

    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledWith('toast_capture_failed')
  })

  it('queues via dataUrl when toDataURL succeeds (toBlob not needed)', async () => {
    // toBlob would throw but dataUrl path is preferred now, so it should still succeed via toDataURL
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: () => {
        throw new Error('boom')
      }
    })

    mountNativePage(1)

    const { result } = renderHook(() =>
      usePdfCaptureActions({
        currentPage: 1,
        queueImageForAi,
        startScreenshot
      })
    )

    await result.current.handleFullPageScreenshot()

    expect(queueImageForAi).toHaveBeenCalledTimes(1)
    expect(queueImageForAi).toHaveBeenCalledWith('data:image/png;base64,mockScreenshotData', {
      page: 1,
      captureKind: 'full-page'
    })
    expect(showError).not.toHaveBeenCalled()
  })

  it('falls back to blob when toDataURL fails but toBlob succeeds', async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      configurable: true,
      value: () => {
        throw new Error('dataUrl boom')
      }
    })

    mountNativePage(1, 400, 300)

    const { result } = renderHook(() =>
      usePdfCaptureActions({
        currentPage: 1,
        queueImageForAi,
        startScreenshot
      })
    )

    await result.current.handleFullPageScreenshot()

    expect(queueImageForAi).toHaveBeenCalledTimes(1)
    expect(queueImageForAi).toHaveBeenCalledWith('blob:mock-url', {
      page: 1,
      captureKind: 'full-page'
    })
    expect(showError).not.toHaveBeenCalled()
  })

  it('shows a toast when both toBlob and toDataURL fail', async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: () => {
        throw new Error('boom')
      }
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      configurable: true,
      value: () => {
        throw new Error('dataUrl boom')
      }
    })

    mountNativePage(1)

    const { result } = renderHook(() =>
      usePdfCaptureActions({
        currentPage: 1,
        queueImageForAi,
        startScreenshot
      })
    )

    await result.current.handleFullPageScreenshot()

    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledWith('toast_capture_failed')
  })

  it('forwards area screenshot request to startScreenshot with the current page meta', () => {
    const { result } = renderHook(() =>
      usePdfCaptureActions({
        currentPage: 7,
        queueImageForAi,
        startScreenshot
      })
    )

    result.current.handleAreaScreenshot()

    expect(startScreenshot).toHaveBeenCalledTimes(1)
    expect(startScreenshot).toHaveBeenCalledWith({
      page: 7,
      captureKind: 'selection'
    })
    expect(queueImageForAi).not.toHaveBeenCalled()
  })

  it('retries to find a page canvas when it is not immediately available', async () => {
    vi.useFakeTimers()
    try {
      mountNativePage(5, 300, 150)

      // Simulate the canvas not being rasterized yet: the first lookup misses, so
      // the progressive retry loop has to run and find it.
      const originalQuerySelector = document.querySelector.bind(document)
      let calls = 0
      const spy = vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
        calls += 1
        if (calls <= 2) return null
        return originalQuerySelector(selector)
      })

      const { result } = renderHook(() =>
        usePdfCaptureActions({
          currentPage: 5,
          queueImageForAi,
          startScreenshot
        })
      )

      const capturePromise = result.current.handleFullPageScreenshot()
      // Advance timers for the retry sleeps (new progressive delays: 30+50+70... total ~900ms)
      await vi.advanceTimersByTimeAsync(600)
      await capturePromise

      expect(queueImageForAi).toHaveBeenCalledTimes(1)
      expect(queueImageForAi).toHaveBeenCalledWith('data:image/png;base64,mockScreenshotData', {
        page: 5,
        captureKind: 'full-page'
      })

      spy.mockRestore()
    } finally {
      vi.useRealTimers()
    }
  })
})
