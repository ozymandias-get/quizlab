import {
  resetReadingProgressStore,
  useReadingProgressPersistence
} from '@features/pdf/hooks/useReadingProgressPersistence'
import { useToastStore } from '@shared/stores/toastStore'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const localStorageMock = (function () {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

describe('reading progress debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorageMock.clear()
    resetReadingProgressStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the pending page of two different PDFs', () => {
    const { result } = renderHook(() => useReadingProgressPersistence())

    act(() => {
      result.current.updateReadingProgress({ path: '/a.pdf', page: 4 })
      result.current.updateReadingProgress({ path: '/b.pdf', page: 11 })
    })

    act(() => {
      vi.advanceTimersByTime(400)
    })

    const info = result.current.getRecentReadingInfo()
    expect(info.find((entry) => entry.path === '/a.pdf')?.page).toBe(4)
    expect(info.find((entry) => entry.path === '/b.pdf')?.page).toBe(11)
  })

  it('does not reset a stored page when the document is opened again', () => {
    const { result } = renderHook(() => useReadingProgressPersistence())

    act(() => {
      result.current.updateReadingProgress({ path: '/a.pdf', page: 150, totalPages: 300 })
    })
    act(() => {
      result.current.recordPdfOpened({ path: '/a.pdf', name: 'a.pdf' })
    })

    expect(
      result.current.getRecentReadingInfo().find((entry) => entry.path === '/a.pdf')?.page
    ).toBe(150)
  })

  it('starts a document with no history on the first page', () => {
    const { result } = renderHook(() => useReadingProgressPersistence())

    act(() => {
      result.current.recordPdfOpened({ path: '/new.pdf', name: 'new.pdf' })
    })

    expect(
      result.current.getRecentReadingInfo().find((entry) => entry.path === '/new.pdf')
    ).toMatchObject({ page: 1, totalPages: 0 })
  })

  it('tells the user when the reading history could not be written', () => {
    const showWarning = vi.spyOn(useToastStore.getState(), 'showWarning')
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('quota exceeded')
    })

    const { result } = renderHook(() => useReadingProgressPersistence())
    act(() => {
      result.current.updateReadingProgress({ path: '/a.pdf', page: 3 })
      vi.advanceTimersByTime(400)
    })

    expect(showWarning).toHaveBeenCalledWith('toast_pdf_history_save_failed')
  })
})
