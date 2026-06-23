import { usePdfResizeRefit } from '@features/pdf/viewport/usePdfResizeRefit'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@react-pdf-viewer/core', () => ({
  SpecialZoomLevel: {
    PageWidth: 'PageWidth'
  },
  ScrollMode: {
    Page: 0,
    Vertical: 1,
    Horizontal: 2
  }
}))

describe('usePdfResizeRefit', () => {
  let resizeObserverCallback: (() => void) | null = null
  let originalResizeObserver: typeof ResizeObserver

  beforeEach(() => {
    vi.useFakeTimers()
    resizeObserverCallback = null
    originalResizeObserver = global.ResizeObserver

    global.ResizeObserver = class ResizeObserver {
      constructor(callback: () => void) {
        resizeObserverCallback = callback
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver

    // The production hook wraps the refit in requestAnimationFrame so the
    // browser has time to compute layout after the debounce. In jsdom there
    // is no real layout pipeline, so run the callback synchronously once
    // the debounce timer has fired.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    global.ResizeObserver = originalResizeObserver
    vi.unstubAllGlobals()
  })

  it('debounces repeated ResizeObserver notifications into a single PageWidth refit', () => {
    const zoomTo = vi.fn()
    const containerRef = { current: document.createElement('div') }
    const bodyAddSpy = vi.spyOn(document.body.classList, 'add')
    const bodyRemoveSpy = vi.spyOn(document.body.classList, 'remove')
    const bodyContainsSpy = vi.spyOn(document.body.classList, 'contains')

    renderHook(() => usePdfResizeRefit(containerRef, zoomTo, true, false))

    expect(resizeObserverCallback).toBeTypeOf('function')

    act(() => {
      resizeObserverCallback?.()
      resizeObserverCallback?.()
      resizeObserverCallback?.()
      vi.advanceTimersByTime(149)
    })

    expect(zoomTo).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(zoomTo).toHaveBeenCalledTimes(1)
    expect(zoomTo).toHaveBeenCalledWith('PageWidth')
    expect(bodyAddSpy).not.toHaveBeenCalled()
    expect(bodyRemoveSpy).not.toHaveBeenCalled()
    expect(bodyContainsSpy).not.toHaveBeenCalled()
  })

  it('waits for panel resizing to finish and refits only once', () => {
    const zoomTo = vi.fn()
    const containerRef = { current: document.createElement('div') }

    const { rerender } = renderHook(
      ({ enabled, isPanelResizing }: { enabled: boolean; isPanelResizing: boolean }) =>
        usePdfResizeRefit(containerRef, zoomTo, enabled, isPanelResizing),
      {
        initialProps: {
          enabled: true,
          isPanelResizing: true
        }
      }
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(zoomTo).not.toHaveBeenCalled()

    rerender({
      enabled: true,
      isPanelResizing: false
    })

    act(() => {
      vi.advanceTimersByTime(149)
    })

    expect(zoomTo).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(zoomTo).toHaveBeenCalledTimes(1)
    expect(zoomTo).toHaveBeenCalledWith('PageWidth')
  })

  it('refits when the document first becomes ready, even without a resize event', () => {
    // Regression: focus mode mounts a fresh PdfViewer; the container's
    // initial ResizeObserver reading can be stale (0x0 or pre-layout),
    // so the refit must also fire when `enabled` flips to true.
    const zoomTo = vi.fn()
    const containerRef = { current: document.createElement('div') }

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        usePdfResizeRefit(containerRef, zoomTo, enabled, false),
      {
        initialProps: { enabled: false }
      }
    )

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(zoomTo).not.toHaveBeenCalled()

    rerender({ enabled: true })

    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(zoomTo).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(zoomTo).toHaveBeenCalledTimes(1)
    expect(zoomTo).toHaveBeenCalledWith('PageWidth')
  })
})
