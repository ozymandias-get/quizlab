/**
 * The native rAF-coalesced zoom channel.
 *
 * The invariant under test is "one effective zoom change per animation frame,
 * latest wins". It is what keeps three zoom requests inside a single frame from
 * producing three renders, each cancelling the previous one — the native
 * equivalent of the legacy viewer's `RenderingCancelledException` race.
 */
import { useNativeCoalescedScale } from '@features/pdf/native/useNativeCoalescedScale'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useNativeCoalescedScale', () => {
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

  it('commits only the latest of several same-frame zoom requests', () => {
    const applyScale = vi.fn()
    const { result } = renderHook(() => useNativeCoalescedScale(applyScale))

    act(() => {
      result.current(1)
      result.current(1.2)
      result.current(1.5)
    })

    expect(rafCallbacks).toHaveLength(1)
    expect(applyScale).not.toHaveBeenCalled()

    act(() => flushRaf())

    expect(applyScale).toHaveBeenCalledTimes(1)
    expect(applyScale).toHaveBeenCalledWith(1.5)
  })

  it('schedules a fresh frame for requests that arrive after the flush', () => {
    const applyScale = vi.fn()
    const { result } = renderHook(() => useNativeCoalescedScale(applyScale))

    act(() => {
      result.current(1)
      flushRaf()
      result.current(2)
    })

    expect(rafCallbacks).toHaveLength(1)
    act(() => flushRaf())

    expect(applyScale).toHaveBeenCalledTimes(2)
    expect(applyScale).toHaveBeenLastCalledWith(2)
  })

  it('always calls the latest applyScale implementation', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result, rerender } = renderHook(({ fn }) => useNativeCoalescedScale(fn), {
      initialProps: { fn: first }
    })

    rerender({ fn: second })
    act(() => {
      result.current(2)
      flushRaf()
    })

    expect(second).toHaveBeenCalledWith(2)
    expect(first).not.toHaveBeenCalled()
  })

  it('cancels the pending frame on unmount so no zoom lands afterwards', () => {
    const applyScale = vi.fn()
    const { result, unmount } = renderHook(() => useNativeCoalescedScale(applyScale))

    act(() => {
      result.current(1)
    })
    unmount()

    expect(cancelRaf).toHaveBeenCalledTimes(1)

    // Even if a stale frame callback is invoked, the pending value is gone.
    act(() => flushRaf())
    expect(applyScale).not.toHaveBeenCalled()
  })
})
