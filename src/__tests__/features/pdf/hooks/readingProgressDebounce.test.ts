import {
  resetReadingProgressStore,
  useReadingProgressPersistence
} from '@features/pdf/hooks/useReadingProgressPersistence'

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
})
