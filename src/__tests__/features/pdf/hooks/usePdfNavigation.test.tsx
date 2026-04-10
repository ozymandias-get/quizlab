import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePdfNavigation } from '@features/pdf/ui/hooks/usePdfNavigation'

describe('usePdfNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize from the saved page and report reading progress updates', () => {
    const onReadingProgressChange = vi.fn()
    const containerRef = { current: document.createElement('div') }
    const jumpToPageRef = { current: vi.fn() }

    const { result, rerender } = renderHook(
      (props: {
        containerRef: typeof containerRef
        jumpToPageRef: typeof jumpToPageRef
        pdfPath: string | null
        initialPage?: number
        onReadingProgressChange: typeof onReadingProgressChange
      }) => usePdfNavigation(props),
      {
        initialProps: {
          containerRef,
          jumpToPageRef,
          pdfPath: '/docs/first.pdf',
          initialPage: 6,
          onReadingProgressChange
        }
      }
    )

    expect(result.current.currentPage).toBe(6)
    expect(result.current.totalPages).toBe(0)

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 12 } })
    })

    expect(result.current.totalPages).toBe(12)
    expect(onReadingProgressChange).toHaveBeenNthCalledWith(1, {
      path: '/docs/first.pdf',
      totalPages: 12,
      lastOpenedAt: expect.any(Number)
    })

    act(() => {
      result.current.handlePageChange({ currentPage: 5 })
    })

    expect(result.current.currentPage).toBe(6)
    expect(onReadingProgressChange).toHaveBeenNthCalledWith(2, {
      path: '/docs/first.pdf',
      page: 6,
      lastOpenedAt: expect.any(Number)
    })

    rerender({
      containerRef,
      jumpToPageRef,
      pdfPath: '/docs/first.pdf',
      initialPage: 8,
      onReadingProgressChange
    })

    expect(result.current.currentPage).toBe(6)
    expect(result.current.totalPages).toBe(12)

    rerender({
      containerRef,
      jumpToPageRef,
      pdfPath: '/docs/second.pdf',
      initialPage: 9,
      onReadingProgressChange
    })

    expect(result.current.currentPage).toBe(9)
    expect(result.current.totalPages).toBe(0)
  })

  it('turns one page forward on vertical wheel intent and waits for page change before another turn', () => {
    const container = document.createElement('div')
    const containerRef = { current: container }
    const jumpToPageRef = { current: vi.fn() }
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

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.handlePageChange({ currentPage: 2 })
      vi.advanceTimersByTime(400)
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
    const jumpToPageRef = { current: vi.fn() }

    const { result } = renderHook(() =>
      usePdfNavigation({
        containerRef,
        jumpToPageRef,
        pdfPath: '/docs/first.pdf',
        initialPage: 3
      })
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

    act(() => {
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, cancelable: true }))
      vi.advanceTimersByTime(150)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(250)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(2)
    expect(jumpToPageRef.current).toHaveBeenNthCalledWith(2, 2)
  })

  it('claims vertical wheel before threshold so sub-threshold deltas do not race native scroll', () => {
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

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    for (let i = 0; i < 4; i++) {
      const ev = new WheelEvent('wheel', { deltaY: 10, cancelable: true })
      act(() => {
        container.dispatchEvent(ev)
      })
      expect(ev.defaultPrevented).toBe(true)
    }

    expect(jumpToPageRef.current).not.toHaveBeenCalled()
  })

  it('turns one page for touchpad-like small deltas once the gesture threshold is reached', () => {
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

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    for (let i = 0; i < 4; i++) {
      act(() => {
        container.dispatchEvent(new WheelEvent('wheel', { deltaY: 12, cancelable: true }))
      })
    }

    expect(jumpToPageRef.current).not.toHaveBeenCalled()

    const finalEvent = new WheelEvent('wheel', { deltaY: 12, cancelable: true })
    act(() => {
      container.dispatchEvent(finalEvent)
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
    expect(jumpToPageRef.current).toHaveBeenCalledWith(2)
    expect(finalEvent.defaultPrevented).toBe(true)
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

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    const w = new WheelEvent('wheel', { deltaY: -60, cancelable: true })
    act(() => {
      container.dispatchEvent(w)
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
    expect(jumpToPageRef.current).toHaveBeenCalledWith(2)
    expect(w.defaultPrevented).toBe(true)
  })

  it('resets wheel accumulation when direction flips so the latest intent wins', () => {
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

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    act(() => {
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, cancelable: true }))
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
    expect(jumpToPageRef.current).toHaveBeenCalledWith(2)
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

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    act(() => {
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)
  })

  it('requires a quiet gap before treating continued wheel momentum as a new gesture', () => {
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

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    act(() => {
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
      result.current.handlePageChange({ currentPage: 2 })
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(300)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
      vi.advanceTimersByTime(65)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
      vi.advanceTimersByTime(100)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(190)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }))
    })

    expect(jumpToPageRef.current).toHaveBeenCalledTimes(2)
    expect(jumpToPageRef.current).toHaveBeenNthCalledWith(2, 3)
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

  it('does not prevent default for horizontal-dominant wheel', () => {
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

    act(() => {
      result.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    const ev = new WheelEvent('wheel', { deltaX: 80, deltaY: 10, cancelable: true })
    act(() => {
      container.dispatchEvent(ev)
    })

    expect(jumpToPageRef.current).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('does not handle wheel before the document page count is known', () => {
    const container = document.createElement('div')
    const containerRef = { current: container }
    const jumpToPageRef = { current: vi.fn() }

    renderHook(() =>
      usePdfNavigation({
        containerRef,
        jumpToPageRef,
        pdfPath: '/docs/first.pdf',
        initialPage: 2
      })
    )

    const ev = new WheelEvent('wheel', { deltaY: 60, cancelable: true })
    act(() => {
      container.dispatchEvent(ev)
    })

    expect(jumpToPageRef.current).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('claims vertical wheel at the first and last page without jumping past bounds', () => {
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

    act(() => {
      firstPageResult.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    const upwardAtFirstPage = new WheelEvent('wheel', { deltaY: -60, cancelable: true })
    act(() => {
      firstPageContainer.dispatchEvent(upwardAtFirstPage)
    })

    expect(firstPageJumpToPageRef.current).not.toHaveBeenCalled()
    expect(upwardAtFirstPage.defaultPrevented).toBe(true)

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

    act(() => {
      lastPageResult.current.handleDocumentLoad({ doc: { numPages: 10 } })
    })

    const downwardAtLastPage = new WheelEvent('wheel', { deltaY: 60, cancelable: true })
    act(() => {
      lastPageContainer.dispatchEvent(downwardAtLastPage)
    })

    expect(lastPageJumpToPageRef.current).not.toHaveBeenCalled()
    expect(downwardAtLastPage.defaultPrevented).toBe(true)
  })
})
