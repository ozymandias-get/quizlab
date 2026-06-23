/**
 * Tests for the shared useDebouncedValue hook. Verifies the trailing-edge
 * semantics: the first update is delayed by `delayMs`, and rapid changes
 * within the window collapse into a single emit of the latest value.
 */
import { useDebouncedValue } from '@shared/hooks'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value synchronously', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 200))
    expect(result.current).toBe('initial')
  })

  it('does not update before the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' }
    })
    rerender({ value: 'b' })
    // 199ms < 200ms — no emit yet
    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(result.current).toBe('a')
  })

  it('emits the latest value after the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' }
    })
    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('b')
  })

  it('collapses rapid updates into a single trailing emit', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' }
    })
    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(50)
    })
    rerender({ value: 'c' })
    act(() => {
      vi.advanceTimersByTime(50)
    })
    rerender({ value: 'd' })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    // Only the latest value 'd' is emitted, 'b' and 'c' are skipped
    expect(result.current).toBe('d')
  })

  it('cancels a pending update when the component unmounts', () => {
    const { result, rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' }
    })
    rerender({ value: 'b' })
    unmount()
    // Should not throw; the cleanup callback clears the pending timer.
    act(() => {
      vi.advanceTimersByTime(200)
    })
    // After unmount, we can only check that the last value is still 'a' (pre-unmount).
    expect(result.current).toBe('a')
  })

  it('emits immediately when delayMs is 0', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 0), {
      initialProps: { value: 'a' }
    })
    rerender({ value: 'b' })
    // Synchronous branch: no timer needed
    expect(result.current).toBe('b')
  })

  it('preserves the latest value across debounce cycles', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' }
    })
    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('b')
    rerender({ value: 'c' })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('c')
  })
})
