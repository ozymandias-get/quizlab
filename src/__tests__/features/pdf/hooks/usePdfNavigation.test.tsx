import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePdfNavigation } from '@features/pdf/ui/hooks/usePdfNavigation'

describe('usePdfNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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
      vi.advanceTimersByTime(350)
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
})
