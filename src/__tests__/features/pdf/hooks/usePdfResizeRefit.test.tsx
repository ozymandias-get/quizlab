import { usePdfResizeRefit } from '@features/pdf/viewport/usePdfResizeRefit'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  // Three triggers, one policy: nothing refits until 150ms have passed with no
  // further trigger, and then it refits exactly once, to scale 1.
  it.each([
    ['repeated ResizeObserver notifications', false, false],
    ['a panel resize that has finished', false, true],
    ['the document becoming ready with no resize at all', true, false]
  ])('debounces %s into a single refit', (_label, startsDisabled, panelIsResizing) => {
    const zoomTo = vi.fn<(scale: unknown) => void>()
    const containerRef = { current: document.createElement('div') }

    const { rerender } = renderHook(
      ({ enabled, isPanelResizing }: { enabled: boolean; isPanelResizing: boolean }) =>
        usePdfResizeRefit(containerRef, zoomTo, enabled, isPanelResizing),
      { initialProps: { enabled: !startsDisabled, isPanelResizing: panelIsResizing } }
    )

    // Whatever the trigger, waiting longer than the debounce on its own must not
    // refit: the hook refits on a *settled* measurement, not on a timer alone.
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(zoomTo).not.toHaveBeenCalled()

    if (startsDisabled) {
      rerender({ enabled: true, isPanelResizing: false })
    } else {
      // A still-active panel resize holds the refit back until the drag ends.
      act(() => {
        resizeObserverCallback?.()
        resizeObserverCallback?.()
        resizeObserverCallback?.()
      })
      rerender({ enabled: true, isPanelResizing: false })
    }

    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(zoomTo).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(zoomTo).toHaveBeenCalledTimes(1)
    expect(zoomTo).toHaveBeenCalledWith(1)
  })

  it('refits to the caller numeric fallback', () => {
    // The viewer passes its own fallback because its fit scale is a computed
    // number rather than a viewer keyword. Same debounce, same debounced
    // window — only the refit target differs.
    const zoomTo = vi.fn<(scale: unknown) => void>()
    const containerRef = { current: document.createElement('div') }

    renderHook(() => usePdfResizeRefit(containerRef, zoomTo, true, false, null, undefined, 1))

    act(() => {
      resizeObserverCallback?.()
      vi.advanceTimersByTime(150)
    })

    expect(zoomTo).toHaveBeenCalledTimes(1)
    expect(zoomTo).toHaveBeenCalledWith(1)
  })

  it('prefers the fit scale over the fallback when one is known', () => {
    const zoomTo = vi.fn<(scale: unknown) => void>()
    const containerRef = { current: document.createElement('div') }

    renderHook(() => usePdfResizeRefit(containerRef, zoomTo, true, false, 1.67, undefined, 1))

    act(() => {
      resizeObserverCallback?.()
      vi.advanceTimersByTime(150)
    })

    expect(zoomTo).toHaveBeenCalledWith(1.67)
  })
})
