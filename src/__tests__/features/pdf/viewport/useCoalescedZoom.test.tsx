import { useCoalescedZoom } from '@features/pdf/viewport/useCoalescedZoom'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useCoalescedZoom', () => {
  let rafCallbacks: FrameRequestCallback[]
  let cancelRaf: ReturnType<typeof vi.fn>

  beforeEach(() => {
    rafCallbacks = []
    cancelRaf = vi.fn()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', cancelRaf)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function flushRaf(): void {
    const callbacks = rafCallbacks.splice(0)
    for (const cb of callbacks) cb(0)
  }

  it('coalesces multiple zoom requests into a single call with the latest scale', () => {
    const zoomTo = vi.fn()
    const { result } = renderHook(() => useCoalescedZoom(zoomTo))

    act(() => {
      result.current(1)
      result.current(1.2)
      result.current(1.5)
    })

    // Only one animation frame scheduled so far, nothing invoked yet.
    expect(rafCallbacks).toHaveLength(1)
    expect(zoomTo).not.toHaveBeenCalled()

    act(() => flushRaf())

    expect(zoomTo).toHaveBeenCalledTimes(1)
    expect(zoomTo).toHaveBeenCalledWith(1.5)
  })

  it('schedules a new frame for zoom requests arriving after the flush', () => {
    const zoomTo = vi.fn()
    const { result } = renderHook(() => useCoalescedZoom(zoomTo))

    act(() => {
      result.current(1)
      flushRaf()
      result.current(2)
    })

    expect(rafCallbacks).toHaveLength(1)
    act(() => flushRaf())
    expect(zoomTo).toHaveBeenCalledTimes(2)
    expect(zoomTo).toHaveBeenLastCalledWith(2)
  })

  it('always calls the latest zoomTo implementation on flush', () => {
    const zoomTo = vi.fn()
    const { result, rerender } = renderHook(({ fn }) => useCoalescedZoom(fn), {
      initialProps: { fn: zoomTo }
    })

    const newZoomTo = vi.fn()
    rerender({ fn: newZoomTo })

    act(() => {
      result.current(1.25)
      flushRaf()
    })

    expect(newZoomTo).toHaveBeenCalledWith(1.25)
    expect(zoomTo).not.toHaveBeenCalled()
  })

  it('cancels a pending frame on unmount', () => {
    const zoomTo = vi.fn()
    const { result, unmount } = renderHook(() => useCoalescedZoom(zoomTo))

    act(() => {
      result.current(1)
    })

    expect(cancelRaf).not.toHaveBeenCalled()
    unmount()
    expect(cancelRaf).toHaveBeenCalledTimes(1)
    expect(zoomTo).not.toHaveBeenCalled()
  })
})
