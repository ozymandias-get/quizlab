/**
 * `usePdfWheelNavigation` — "a vertical wheel gesture turns exactly one page".
 *
 * This hook is the whole of wheel navigation: `useNativePdfController` mounts it
 * against the shared viewer container and nothing else turns a page from the wheel.
 * Its policy is entirely in the two timers and the `preventDefault` discipline, and
 * that policy is what keeps a trackpad's momentum tail from bouncing the reader back
 * to the page they came from — a failure mode that is invisible in a screenshot and
 * obvious in use, so it is pinned here rather than left to the page state.
 *
 * These cases were the hook's own coverage before the `usePdfNavigation` tests went
 * with that hook; they are kept against the hook directly, since it is standalone.
 */
import { usePdfWheelNavigation } from '@features/pdf/viewport/usePdfWheelNavigation'

import { act, renderHook } from '@testing-library/react'
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function wheel(init: WheelEventInit & { deltaY: number }): WheelEvent {
  return new WheelEvent('wheel', { cancelable: true, ...init })
}

describe('usePdfWheelNavigation', () => {
  let container: HTMLDivElement
  let goToNextPage: Mock<() => void>
  let goToPreviousPage: Mock<() => void>

  function mount(enabled = true) {
    const containerRef = { current: container }
    return renderHook(() =>
      usePdfWheelNavigation(containerRef, goToNextPage, goToPreviousPage, enabled)
    )
  }

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    goToNextPage = vi.fn()
    goToPreviousPage = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('turns one page per gesture, not per wheel event', () => {
    mount()

    // Every event is claimed — including the ones the gesture lock drops — because
    // `ScrollMode.Page` does not scroll either, so leaving the default in place would
    // scroll the panel behind the page.
    for (let i = 0; i < 4; i++) {
      const event = wheel({ deltaY: 60 })
      act(() => {
        container.dispatchEvent(event)
      })
      expect(event.defaultPrevented).toBe(true)
    }

    expect(goToNextPage).toHaveBeenCalledTimes(1)
    expect(goToPreviousPage).not.toHaveBeenCalled()
  })

  it('accepts the next gesture once the wheel stream has gone idle', () => {
    mount()

    act(() => {
      container.dispatchEvent(wheel({ deltaY: 60 }))
    })
    expect(goToNextPage).toHaveBeenCalledTimes(1)

    // Still inside the idle window measured from the last wheel event: this belongs
    // to the gesture already in flight.
    act(() => {
      vi.advanceTimersByTime(150)
      container.dispatchEvent(wheel({ deltaY: 60 }))
    })
    expect(goToNextPage).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(240)
      container.dispatchEvent(wheel({ deltaY: 60 }))
    })
    expect(goToNextPage).toHaveBeenCalledTimes(2)
  })

  it('turns one page back on an upward gesture', () => {
    mount()

    const event = wheel({ deltaY: -60 })
    act(() => {
      container.dispatchEvent(event)
    })

    expect(goToPreviousPage).toHaveBeenCalledTimes(1)
    expect(goToNextPage).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('claims a zero delta without turning a page or locking the gesture', () => {
    mount()

    // A trackpad two-finger scroll reports one, so the default still has to be
    // prevented — but there is no page-turn intent in it, and it must not consume the
    // one allowed turn of the gesture either.
    const zero = wheel({ deltaY: 0 })
    act(() => {
      container.dispatchEvent(zero)
    })

    expect(zero.defaultPrevented).toBe(true)
    expect(goToNextPage).not.toHaveBeenCalled()
    expect(goToPreviousPage).not.toHaveBeenCalled()

    act(() => {
      container.dispatchEvent(wheel({ deltaY: 60 }))
    })
    expect(goToNextPage).toHaveBeenCalledTimes(1)
  })

  it('keeps an opposite momentum tail out for the duration of one gesture', () => {
    // The gesture idle lock alone cannot tell a late opposite tail from a new
    // gesture: some mouse drivers emit the tail after their momentum stream has
    // already gone idle, and a reader who has just turned forward must not be thrown
    // back. The accepted direction therefore stays sticky for a safety window, which
    // is a *separate* mechanism from the idle lock — see the next case.
    mount()

    act(() => {
      container.dispatchEvent(wheel({ deltaY: 60 }))
    })
    expect(goToNextPage).toHaveBeenCalledTimes(1)

    // The stream has gone idle, so the gesture lock has released and the opposite
    // direction is only refused because the direction safety window has not passed.
    act(() => {
      vi.advanceTimersByTime(300)
      container.dispatchEvent(wheel({ deltaY: -20 }))
    })
    expect(goToPreviousPage).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
      container.dispatchEvent(wheel({ deltaY: -60 }))
    })
    expect(goToPreviousPage).not.toHaveBeenCalled()

    // A deliberate reversal is accepted once that window has passed.
    act(() => {
      vi.advanceTimersByTime(400)
      container.dispatchEvent(wheel({ deltaY: -60 }))
    })
    expect(goToPreviousPage).toHaveBeenCalledTimes(1)
  })

  it('discards a whole gesture that keeps rearming the idle lock', () => {
    // The companion mechanism: while the stream keeps arriving, the 240 ms idle
    // window is rearmed by every event and no second turn is accepted at all,
    // whatever the direction. Opposite tails are dropped by the idle lock here, not
    // by the direction window — the two are independent guards.
    mount()

    act(() => {
      container.dispatchEvent(wheel({ deltaY: 60 }))
      vi.advanceTimersByTime(150)
      container.dispatchEvent(wheel({ deltaY: -20 }))
      vi.advanceTimersByTime(150)
      container.dispatchEvent(wheel({ deltaY: -10 }))
      vi.advanceTimersByTime(150)
      container.dispatchEvent(wheel({ deltaY: -5 }))
    })

    expect(goToNextPage).toHaveBeenCalledTimes(1)
    expect(goToPreviousPage).not.toHaveBeenCalled()
  })

  it('leaves Ctrl and Meta wheel to the zoom hook', () => {
    mount()

    const withCtrl = wheel({ deltaY: 60, ctrlKey: true })
    const withMeta = wheel({ deltaY: 60, metaKey: true })
    act(() => {
      container.dispatchEvent(withCtrl)
      container.dispatchEvent(withMeta)
    })

    expect(goToNextPage).not.toHaveBeenCalled()
    expect(goToPreviousPage).not.toHaveBeenCalled()
    // Not claimed either: `usePdfCtrlWheelZoom` owns this gesture, and two hooks
    // preventing the same default is how a zoom gesture ends up cancelled twice.
    expect(withCtrl.defaultPrevented).toBe(false)
    expect(withMeta.defaultPrevented).toBe(false)
  })

  it('turns no pages while disabled, and stops listening once enabled', () => {
    const { rerender } = renderHook(
      ({ on }) => {
        const containerRef = { current: container }
        usePdfWheelNavigation(containerRef, goToNextPage, goToPreviousPage, on)
      },
      { initialProps: { on: false } }
    )

    act(() => {
      container.dispatchEvent(wheel({ deltaY: 60 }))
    })
    expect(goToNextPage).not.toHaveBeenCalled()

    rerender({ on: true })
    act(() => {
      container.dispatchEvent(wheel({ deltaY: 60 }))
    })
    expect(goToNextPage).toHaveBeenCalledTimes(1)
  })

  it('releases the listener, the timer and the gesture state on unmount', () => {
    const { unmount } = mount()

    act(() => {
      container.dispatchEvent(wheel({ deltaY: 60 }))
    })
    unmount()

    // The pending idle timer must not survive the hook, and the listener must be
    // gone: the container outlives the viewer, and a second viewer would otherwise
    // inherit a locked gesture from the one that unmounted.
    act(() => {
      vi.advanceTimersByTime(1000)
      container.dispatchEvent(wheel({ deltaY: 60 }))
    })
    expect(goToNextPage).toHaveBeenCalledTimes(1)
  })
})
