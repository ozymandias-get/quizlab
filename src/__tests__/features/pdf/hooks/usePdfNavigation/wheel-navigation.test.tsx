import { usePdfNavigation } from '@features/pdf/ui/hooks/usePdfNavigation'
import { usePdfWheelNavigation } from '@features/pdf/viewport/usePdfWheelNavigation'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('usePdfNavigation - wheel navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('turns one page forward on vertical wheel intent and waits for page change before another turn', () => {
    const container = document.createElement('div')
    const containerRef = { current: container }
    const jumpToPageRef: React.MutableRefObject<(pageIndex: number) => void> = { current: vi.fn() }
    const onReadingProgressChange = vi.fn()

    const { result } = renderHook(() =>
      usePdfNavigation({
        containerRef,
        jumpToPageRef,
        pdfPath: '/docs/first.pdf',
        initialPage: 2,
        onReadingProgressChange
      })
    )

    // Mount usePdfWheelNavigation to listen for wheel events
    renderHook(() =>
      usePdfWheelNavigation(
        containerRef,
        result.current.goToNextPage,
        result.current.goToPreviousPage,
        true
      )
    )

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    const firstWheel = new WheelEvent('wheel', { deltaY: 60, cancelable: true })
    act(() => {
      container.dispatchEvent(firstWheel)
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
    expect(jumpToPageRef.current).toHaveBeenCalledWith(2)
    expect(firstWheel.defaultPrevented).toBe(true)

    const secondWheel = new WheelEvent('wheel', { deltaY: 60, cancelable: true })
    act(() => {
      container.dispatchEvent(secondWheel)
    })

    // Throttle prevents a second jump
    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.handlePageChange({ currentPage: 2 })
      vi.advanceTimersByTime(500)
    })

    const thirdWheel = new WheelEvent('wheel', { deltaY: 60, cancelable: true })
    act(() => {
      container.dispatchEvent(thirdWheel)
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(2)
    expect(jumpToPageRef.current).toHaveBeenNthCalledWith(2, 3)
  })

  it('ignores opposite inertia events right after a page turn', () => {
    const container = document.createElement('div')
    const containerRef = { current: container }
    const jumpToPageRef: React.MutableRefObject<(pageIndex: number) => void> = { current: vi.fn() }

    const { result } = renderHook(() =>
      usePdfNavigation({
        containerRef,
        jumpToPageRef,
        pdfPath: '/docs/first.pdf',
        initialPage: 3
      })
    )

    renderHook(() =>
      usePdfWheelNavigation(
        containerRef,
        result.current.goToNextPage,
        result.current.goToPreviousPage,
        true
      )
    )

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    act(() => {
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
    expect(jumpToPageRef.current).toHaveBeenCalledWith(3)

    act(() => {
      result.current.handlePageChange({ currentPage: 3 })
    })

    // Dispatch opposite-direction events within the inertia window
    act(() => {
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, cancelable: true }))
      vi.advanceTimersByTime(150)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)

    // Opposite-direction tails remain blocked beyond the gesture idle window.
    act(() => {
      vi.advanceTimersByTime(250)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)

    // A deliberate reversal is accepted after the direction safety window.
    act(() => {
      vi.advanceTimersByTime(700)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(2)
    expect(jumpToPageRef.current).toHaveBeenNthCalledWith(2, 2)
  })

  it('keeps opposite momentum locked even when the wheel stream lasts over 300ms', () => {
    const container = document.createElement('div')
    const containerRef = { current: container }
    const goToNextPage = vi.fn()
    const goToPreviousPage = vi.fn()

    renderHook(() => usePdfWheelNavigation(containerRef, goToNextPage, goToPreviousPage, true))

    act(() => {
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
      vi.advanceTimersByTime(150)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -20, cancelable: true }))
      vi.advanceTimersByTime(150)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, cancelable: true }))
      vi.advanceTimersByTime(150)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -5, cancelable: true }))
    })

    expect(goToNextPage).toHaveBeenCalledTimes(1)
    expect(goToPreviousPage).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(900)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, cancelable: true }))
    })

    expect(goToPreviousPage).toHaveBeenCalledTimes(1)
  })

  it('turns one page back on a single upward wheel gesture', () => {
    const container = document.createElement('div')
    const containerRef = { current: container }
    const jumpToPageRef = { current: vi.fn() }

    const { result } = renderHook(() =>
      usePdfNavigation({
        containerRef,
        jumpToPageRef,
        pdfPath: '/docs/first.pdf',
        initialPage: 4
      })
    )

    renderHook(() =>
      usePdfWheelNavigation(
        containerRef,
        result.current.goToNextPage,
        result.current.goToPreviousPage,
        true
      )
    )

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    const w = new WheelEvent('wheel', { deltaY: -60, cancelable: true })
    act(() => {
      container.dispatchEvent(w)
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
    // Upward wheel → goToPreviousPage → jumpToPage(currentPage - 2) = jumpToPage(2)
    expect(jumpToPageRef.current).toHaveBeenCalledWith(2)
    expect(w.defaultPrevented).toBe(true)
  })

  it('throttles rapid wheel events even when direction changes', () => {
    const container = document.createElement('div')
    const containerRef = { current: container }
    const jumpToPageRef = { current: vi.fn() }

    const { result } = renderHook(() =>
      usePdfNavigation({
        containerRef,
        jumpToPageRef,
        pdfPath: '/docs/first.pdf',
        initialPage: 4
      })
    )

    renderHook(() =>
      usePdfWheelNavigation(
        containerRef,
        result.current.goToNextPage,
        result.current.goToPreviousPage,
        true
      )
    )

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    // Dispatch two wheels with opposite directions in the same tick.
    // The first (deltaY > 0) fires goToNextPage; the second is throttled.
    act(() => {
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, cancelable: true }))
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, cancelable: true }))
    })

    // Only the first event should fire (goToNextPage → jumpToPage(4))
    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
    expect(jumpToPageRef.current).toHaveBeenCalledWith(4)
  })

  it('does not fire a second jump while the first wheel navigation is still pending', () => {
    const container = document.createElement('div')
    const containerRef = { current: container }
    const jumpToPageRef = { current: vi.fn() }

    const { result } = renderHook(() =>
      usePdfNavigation({
        containerRef,
        jumpToPageRef,
        pdfPath: '/docs/first.pdf',
        initialPage: 2
      })
    )

    renderHook(() =>
      usePdfWheelNavigation(
        containerRef,
        result.current.goToNextPage,
        result.current.goToPreviousPage,
        true
      )
    )

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    // Two wheel events in the same act — throttle prevents the second jump
    act(() => {
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
  })

  it('serializes rapid page jumps until the rendered target has settled', () => {
    const containerRef = { current: document.createElement('div') }
    const jumpToPageRef = { current: vi.fn() }

    const { result } = renderHook(() =>
      usePdfNavigation({
        containerRef,
        jumpToPageRef,
        pdfPath: '/docs/first.pdf',
        initialPage: 2
      })
    )

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    act(() => {
      result.current.goToNextPage()
      result.current.goToNextPage()
      result.current.goToPreviousPage()
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
    expect(jumpToPageRef.current).toHaveBeenCalledWith(2)

    act(() => {
      result.current.handlePageChange({ currentPage: 2 })
      vi.advanceTimersByTime(449)
      result.current.goToNextPage()
    })
    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(1)
      result.current.goToNextPage()
    })
    expect(jumpToPageRef.current).toHaveBeenCalledTimes(2)
    expect(jumpToPageRef.current).toHaveBeenLastCalledWith(3)
  })

  it('ignores stale page-change callbacks after the jump target is rendered', () => {
    const containerRef = { current: document.createElement('div') }
    const jumpToPageRef = { current: vi.fn() }

    const { result } = renderHook(() =>
      usePdfNavigation({
        containerRef,
        jumpToPageRef,
        pdfPath: '/docs/first.pdf',
        initialPage: 2
      })
    )

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    act(() => {
      result.current.goToNextPage()
      result.current.handlePageChange({ currentPage: 2 })
      // The viewer can emit the unmounted source page after the target page.
      result.current.handlePageChange({ currentPage: 1 })
    })

    expect(jumpToPageRef.current).toHaveBeenCalledWith(2)
    expect(result.current.currentPage).toBe(3)
  })
})
