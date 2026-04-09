import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePdfResizeRefit } from '@features/pdf/ui/hooks/usePdfResizeRefit'

vi.mock('@react-pdf-viewer/core', () => ({
  SpecialZoomLevel: {
    PageWidth: 'PageWidth'
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
  })

  afterEach(() => {
    global.ResizeObserver = originalResizeObserver
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
})
