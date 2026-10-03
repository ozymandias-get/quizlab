import { useAiSessionSleep } from '@features/ai/ui/useAiSessionWebview'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SLEEP_TIMEOUT_MS = 60_000

describe('useAiSessionSleep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not sleep an active tab', () => {
    const { result } = renderHook(() =>
      useAiSessionSleep(true, SLEEP_TIMEOUT_MS, () => false, 'chatgpt')
    )

    act(() => {
      vi.advanceTimersByTime(SLEEP_TIMEOUT_MS * 5)
    })

    expect(result.current.isSleeping).toBe(false)
  })

  it('sleeps an inactive tab after the timeout', () => {
    const { result } = renderHook(() =>
      useAiSessionSleep(false, SLEEP_TIMEOUT_MS, () => false, 'chatgpt')
    )

    expect(result.current.isSleeping).toBe(false)
    act(() => {
      vi.advanceTimersByTime(SLEEP_TIMEOUT_MS)
    })
    expect(result.current.isSleeping).toBe(true)
  })

  it('never sleeps when the timeout is infinite', () => {
    const { result } = renderHook(() =>
      useAiSessionSleep(false, Number.POSITIVE_INFINITY, () => false, 'chatgpt')
    )

    act(() => {
      vi.advanceTimersByTime(SLEEP_TIMEOUT_MS * 100)
    })

    expect(result.current.isSleeping).toBe(false)
  })

  it('never sleeps a site configured as never-sleep', () => {
    const { result } = renderHook(() =>
      useAiSessionSleep(false, SLEEP_TIMEOUT_MS, () => true, 'chatgpt')
    )

    act(() => {
      vi.advanceTimersByTime(SLEEP_TIMEOUT_MS * 100)
    })

    expect(result.current.isSleeping).toBe(false)
  })

  it('wakes immediately when the tab becomes active again', () => {
    const { result, rerender } = renderHook(
      ({ isActive }: { isActive: boolean }) =>
        useAiSessionSleep(isActive, SLEEP_TIMEOUT_MS, () => false, 'chatgpt'),
      { initialProps: { isActive: false } }
    )

    act(() => {
      vi.advanceTimersByTime(SLEEP_TIMEOUT_MS)
    })
    expect(result.current.isSleeping).toBe(true)

    rerender({ isActive: true })
    expect(result.current.isSleeping).toBe(false)
  })

  it('re-arms the sleep timer after a manual wake-up on an inactive tab', () => {
    // Regression: handleWakeUp() used to call setIsSleeping(false) directly,
    // which changed no dependency of the sleep effect. An inactive tab woken
    // from SleepPlaceholderView therefore kept its <webview> mounted forever,
    // even though maxAliveTabs is only a cap on how many sessions stay alive —
    // the sleep budget is what is supposed to release a non-active one.
    const { result } = renderHook(() =>
      useAiSessionSleep(false, SLEEP_TIMEOUT_MS, () => false, 'chatgpt')
    )

    act(() => {
      vi.advanceTimersByTime(SLEEP_TIMEOUT_MS)
    })
    expect(result.current.isSleeping).toBe(true)

    act(() => {
      result.current.handleWakeUp()
    })
    expect(result.current.isSleeping).toBe(false)

    act(() => {
      vi.advanceTimersByTime(SLEEP_TIMEOUT_MS)
    })
    expect(result.current.isSleeping).toBe(true)
  })
})
