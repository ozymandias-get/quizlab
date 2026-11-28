/**
 * Reading progress that has not reached the store yet.
 *
 * The page state reports a page change after 300 ms so a burst of page turns
 * does not write per turn. A tab that closes, or a document that is replaced,
 * inside that window used to clear the timer and lose the page: the store
 * never heard about the change and the stored position stayed where the reader
 * was before.
 */
import { useNativePdfPageState } from '@features/pdf/native/useNativePdfPageState'
import { readReadingHistory } from '@features/pdf/hooks/readingHistoryRepository'
import { resetReadingProgressStore } from '@features/pdf/hooks/useReadingProgressPersistence'

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface HostProps {
  path: string | null
  onChange: (update: { path: string; page?: number; totalPages?: number }) => void
}

function Host({ path, onChange }: HostProps) {
  const state = useNativePdfPageState({
    enabled: true,
    pdfUrl: 'local-pdf://a',
    reloadKey: 0,
    totalPages: 10,
    initialPage: 1,
    pdfPath: path,
    onReadingProgressChange: onChange
  })
  return (
    <button type="button" onClick={state.goToNextPage} data-page={state.currentPage}>
      next
    </button>
  )
}

/** The page-reporting calls, without the totalPages-only write of a mount. */
function pageCalls(onChange: ReturnType<typeof vi.fn>) {
  return onChange.mock.calls
    .map(([update]) => update as { path: string; page?: number })
    .filter((update) => typeof update.page === 'number')
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  resetReadingProgressStore()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('reading progress inside the debounce window', () => {
  it('reports the page that was still waiting when the tab closes', () => {
    const onChange = vi.fn()
    const view = render(<Host path="/a.pdf" onChange={onChange} />)

    act(() => {
      view.getByRole('button').click()
    })
    expect(pageCalls(onChange)).toEqual([])

    view.unmount()

    expect(pageCalls(onChange)).toEqual([
      { path: '/a.pdf', page: 2, lastOpenedAt: expect.any(Number) }
    ])
  })

  it('reports the old document page when another document replaces it', () => {
    const onChange = vi.fn()
    const view = render(<Host path="/a.pdf" onChange={onChange} />)

    act(() => {
      view.getByRole('button').click()
    })

    act(() => {
      view.rerender(<Host path="/b.pdf" onChange={onChange} />)
    })

    expect(pageCalls(onChange)[0]).toMatchObject({ path: '/a.pdf', page: 2 })
  })

  it('writes the waiting page when the window is torn down without an unmount', () => {
    // A window close tears the renderer down; React never unmounts. The store's
    // teardown flush asks the viewer for the page it still holds, so the turn
    // that is inside the 300 ms window reaches the disk with that same write.
    const view = render(<Host path="/a.pdf" onChange={vi.fn()} />)

    act(() => {
      view.getByRole('button').click()
    })
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })

    const entry = readReadingHistory().find((item) => item.path === '/a.pdf')
    expect(entry?.page).toBe(2)
  })

  it('does not write the same page twice after the debounce already reported it', () => {
    const onChange = vi.fn()
    const view = render(<Host path="/a.pdf" onChange={onChange} />)

    act(() => {
      view.getByRole('button').click()
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(pageCalls(onChange)).toHaveLength(1)
    onChange.mockClear()

    view.unmount()

    expect(pageCalls(onChange)).toEqual([])
  })
})
