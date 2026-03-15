import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { usePdfNavigation } from '@features/pdf/ui/hooks/usePdfNavigation'

describe('usePdfNavigation', () => {
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
})
