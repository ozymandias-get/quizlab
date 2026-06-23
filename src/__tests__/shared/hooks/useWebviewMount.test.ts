/**
 * Tests for useWebviewMount — defers mounting the (expensive) webview
 * element until either requestIdleCallback fires or 120ms elapses.
 */
import { useWebviewMount } from '@shared/hooks/useWebviewMount'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useWebviewMount', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with isWebviewMounted = false', () => {
    const { result } = renderHook(() => useWebviewMount())
    expect(result.current).toBe(false)
  })

  it('mounts after 120ms when requestIdleCallback is unavailable', () => {
    const original = (window as any).requestIdleCallback
    ;(window as any).requestIdleCallback = undefined

    try {
      const { result } = renderHook(() => useWebviewMount())
      expect(result.current).toBe(false)

      act(() => {
        vi.advanceTimersByTime(120)
      })

      expect(result.current).toBe(true)
    } finally {
      ;(window as any).requestIdleCallback = original
    }
  })

  it('mounts on requestIdleCallback when available', () => {
    const idleCallback = vi.fn()
    const original = (window as any).requestIdleCallback
    ;(window as any).requestIdleCallback = idleCallback

    try {
      renderHook(() => useWebviewMount())
      expect(idleCallback).toHaveBeenCalled()
    } finally {
      ;(window as any).requestIdleCallback = original
    }
  })

  it('does not mount if unmounted before the timer fires', () => {
    const original = (window as any).requestIdleCallback
    ;(window as any).requestIdleCallback = undefined

    try {
      const { result, unmount } = renderHook(() => useWebviewMount())

      // Unmount before the timer fires
      unmount()

      // Advance the timer
      act(() => {
        vi.advanceTimersByTime(200)
      })

      // State should not have been updated (last state is false)
      expect(result.current).toBe(false)
    } finally {
      ;(window as any).requestIdleCallback = original
    }
  })

  it('passes a 300ms timeout to requestIdleCallback', () => {
    const idleCallback = vi.fn()
    const original = (window as any).requestIdleCallback
    ;(window as any).requestIdleCallback = idleCallback

    try {
      renderHook(() => useWebviewMount())
      expect(idleCallback).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ timeout: 300 })
      )
    } finally {
      ;(window as any).requestIdleCallback = original
    }
  })

  it('cancels requestIdleCallback on unmount', () => {
    const cancelIdleCallback = vi.fn()
    let idleId = 42
    const idleCallback = vi.fn(() => idleId)
    const originalRic = (window as any).requestIdleCallback
    const originalCic = (window as any).cancelIdleCallback
    ;(window as any).requestIdleCallback = idleCallback
    ;(window as any).cancelIdleCallback = cancelIdleCallback

    try {
      const { unmount } = renderHook(() => useWebviewMount())
      unmount()
      expect(cancelIdleCallback).toHaveBeenCalledWith(idleId)
    } finally {
      ;(window as any).requestIdleCallback = originalRic
      ;(window as any).cancelIdleCallback = originalCic
    }
  })
})
