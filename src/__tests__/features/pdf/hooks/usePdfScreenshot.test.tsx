import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const showError = vi.fn()
vi.mock('@app/providers', () => ({
  useToastActions: () => ({ showError })
}))

// Import after mock is registered
const { usePdfCaptureActions } = await import('@features/pdf/capture/usePdfCaptureActions')

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

  it('captures the current page layer canvas using 1-based data-page-number', async () => {
    const page12Layer = document.createElement('div')
    page12Layer.className = 'rpv-core__page-layer'
    page12Layer.setAttribute('data-page-number', '12')
    const page12Canvas = document.createElement('canvas')
    Object.defineProperty(page12Canvas, 'width', { configurable: true, value: 400 })
    Object.defineProperty(page12Canvas, 'height', { configurable: true, value: 200 })
    page12Layer.appendChild(page12Canvas)

    const page13Layer = document.createElement('div')
    page13Layer.className = 'rpv-core__page-layer'
    page13Layer.setAttribute('data-page-number', '13')
    const page13Canvas = document.createElement('canvas')
    Object.defineProperty(page13Canvas, 'width', { configurable: true, value: 420 })
    Object.defineProperty(page13Canvas, 'height', { configurable: true, value: 210 })
    page13Layer.appendChild(page13Canvas)

    document.body.appendChild(page12Layer)
    document.body.appendChild(page13Layer)

    const { result } = renderHook(() =>
      usePdfCaptureActions({
        currentPage: 13,
        queueImageForAi,
        startScreenshot
      })
    )

    await result.current.handleFullPageScreenshot()

    expect(queueImageForAi).toHaveBeenCalledTimes(1)
    expect(queueImageForAi).toHaveBeenCalledWith('blob:mock-url', {
      page: 13,
      captureKind: 'full-page'
    })
  })

  it('does nothing and skips the toast when no canvas is found after retries', async () => {
    // No rpv-core__page-layer in the DOM at all
    const { result } = renderHook(() =>
      usePdfCaptureActions({
        currentPage: 1,
        queueImageForAi,
        startScreenshot
      })
    )

    await result.current.handleFullPageScreenshot()

    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
  })

  it('shows a toast when canvas capture throws', async () => {
    // Force toBlob to throw — captureCanvasAsBlob will surface the failure
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: () => {
        throw new Error('boom')
      }
    })

    const layer = document.createElement('div')
    layer.className = 'rpv-core__page-layer'
    layer.setAttribute('data-page-number', '1')
    layer.appendChild(document.createElement('canvas'))
    document.body.appendChild(layer)

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
      const layer = document.createElement('div')
      layer.className = 'rpv-core__page-layer'
      layer.setAttribute('data-page-number', '5')
      const canvas = document.createElement('canvas')
      Object.defineProperty(canvas, 'width', { configurable: true, value: 300 })
      Object.defineProperty(canvas, 'height', { configurable: true, value: 150 })
      layer.appendChild(canvas)
      document.body.appendChild(layer)

      const originalQuerySelector = document.querySelector.bind(document)
      let calls = 0
      const spy = vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
        calls += 1
        // First 2 lookups (initial + 1 retry) return null to simulate canvas still rendering
        if (selector.includes('data-page-number="5"') && calls <= 2) {
          return null
        }
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
      // Advance timers for the retry sleeps
      await vi.advanceTimersByTimeAsync(200)
      await capturePromise

      expect(queueImageForAi).toHaveBeenCalledTimes(1)
      expect(queueImageForAi).toHaveBeenCalledWith('blob:mock-url', {
        page: 5,
        captureKind: 'full-page'
      })

      spy.mockRestore()
    } finally {
      vi.useRealTimers()
    }
  })
})
