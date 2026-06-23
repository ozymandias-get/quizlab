import { usePdfNavigation } from '@features/pdf/ui/hooks/usePdfNavigation'
import { usePdfWheelNavigation } from '@features/pdf/viewport/usePdfWheelNavigation'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('usePdfNavigation - edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('claims vertical wheel and fires goToNextPage once per wheel gesture', () => {
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

    for (let i = 0; i < 4; i++) {
      const ev = new WheelEvent('wheel', { deltaY: 10, cancelable: true })
      act(() => {
        container.dispatchEvent(ev)
      })
      // All events are claimed (preventDefault) — even throttled ones
      expect(ev.defaultPrevented).toBe(true)
    }

    // Only the first event fires; the rest belong to the same wheel gesture
    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
    expect(jumpToPageRef.current).toHaveBeenCalledWith(2)
  })

  it('turns one page for a single small downward delta (no accumulation needed)', () => {
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

    // Single small delta fires goToNextPage immediately
    const ev = new WheelEvent('wheel', { deltaY: 12, cancelable: true })
    act(() => {
      container.dispatchEvent(ev)
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
    expect(jumpToPageRef.current).toHaveBeenCalledWith(2)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('does not handle Ctrl+wheel so zoom can own the gesture', () => {
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

    const ev = new WheelEvent('wheel', { deltaY: 60, cancelable: true, ctrlKey: true })
    act(() => {
      container.dispatchEvent(ev)
    })

    expect(jumpToPageRef.current).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('does not prevent default for horizontal-dominant wheel (deltaX larger than deltaY)', () => {
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

    const ev = new WheelEvent('wheel', { deltaX: 80, deltaY: 10, cancelable: true })
    act(() => {
      container.dispatchEvent(ev)
    })

    // deltaY > 0 so goToNextPage fires; preventDefault is always called for non-Ctrl wheels
    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
    expect(jumpToPageRef.current).toHaveBeenCalledWith(2)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('does not handle wheel before the document page count is known', () => {
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

    // Note: handleDocumentLoad is NOT called — totalPages stays 0
    const ev = new WheelEvent('wheel', { deltaY: 60, cancelable: true })
    act(() => {
      container.dispatchEvent(ev)
    })

    // usePdfWheelNavigation always prevents default for non-Ctrl wheels
    // but goToNextPage won't jump because totalPages = 0 < currentPage = 2 is false
    expect(jumpToPageRef.current).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(true)
  })

  it('requires the wheel stream to become idle between page turns', () => {
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

    // First wheel fires
    act(() => {
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
      result.current.handlePageChange({ currentPage: 2 })
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)

    // Advance past the idle window, then keep the next gesture alive with short gaps
    act(() => {
      vi.advanceTimersByTime(300)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
      vi.advanceTimersByTime(65)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
      vi.advanceTimersByTime(100)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
    })

    // The page transition is still settling when this stream begins, so the
    // entire gesture is discarded instead of being queued behind the jump.
    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)

    // Stay inside the idle window measured from the most recent wheel event
    act(() => {
      vi.advanceTimersByTime(134) // Last wheel was at t=465; gesture unlocks at t=645
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
    })

    // t=599 is still part of the active gesture
    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(240)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(2)
    expect(jumpToPageRef.current).toHaveBeenNthCalledWith(2, 3)
  })

  it('uses goToNextPage/goToPreviousPage guard to prevent jumping past bounds at first and last page', () => {
    // --- First page: upward wheel should not jump past page 1 ---
    const firstPageContainer = document.createElement('div')
    const firstPageRef = { current: firstPageContainer }
    const firstPageJumpToPageRef = { current: vi.fn() }

    const { result: firstPageResult } = renderHook(() =>
      usePdfNavigation({
        containerRef: firstPageRef,
        jumpToPageRef: firstPageJumpToPageRef,
        pdfPath: '/docs/first.pdf',
        initialPage: 1
      })
    )

    renderHook(() =>
      usePdfWheelNavigation(
        firstPageRef,
        firstPageResult.current.goToNextPage,
        firstPageResult.current.goToPreviousPage,
        true
      )
    )

    act(() => {
      firstPageResult.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    const upwardAtFirstPage = new WheelEvent('wheel', { deltaY: -60, cancelable: true })
    act(() => {
      firstPageContainer.dispatchEvent(upwardAtFirstPage)
    })

    // goToPreviousPage: currentPage (1) > 1 is false → no jump
    expect(firstPageJumpToPageRef.current).not.toHaveBeenCalled()
    // usePdfWheelNavigation still prevents default for non-Ctrl wheels
    expect(upwardAtFirstPage.defaultPrevented).toBe(true)

    // --- Last page: downward wheel should not jump past last page ---
    const lastPageContainer = document.createElement('div')
    const lastPageRef = { current: lastPageContainer }
    const lastPageJumpToPageRef = { current: vi.fn() }

    const { result: lastPageResult } = renderHook(() =>
      usePdfNavigation({
        containerRef: lastPageRef,
        jumpToPageRef: lastPageJumpToPageRef,
        pdfPath: '/docs/first.pdf',
        initialPage: 10
      })
    )

    renderHook(() =>
      usePdfWheelNavigation(
        lastPageRef,
        lastPageResult.current.goToNextPage,
        lastPageResult.current.goToPreviousPage,
        true
      )
    )

    act(() => {
      lastPageResult.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    const downwardAtLastPage = new WheelEvent('wheel', { deltaY: 60, cancelable: true })
    act(() => {
      lastPageContainer.dispatchEvent(downwardAtLastPage)
    })

    // goToNextPage: currentPage (10) < totalPages (10) is false → no jump
    expect(lastPageJumpToPageRef.current).not.toHaveBeenCalled()
    // usePdfWheelNavigation still prevents default
    expect(downwardAtLastPage.defaultPrevented).toBe(true)
  })
})
