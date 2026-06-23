import type { WebviewElement } from '@shared-core/types/webview'

import { useWebviewCrasher } from '@shared/hooks/webview/useWebviewCrasher'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useWebviewCrasher', () => {
  let activeWebviewRef: { current: WebviewElement | null }
  let showWarning: (key: string) => void
  let onCrashMaxReached: () => void
  let onRecoveryRequested: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    activeWebviewRef = { current: {} as WebviewElement }
    showWarning = vi.fn()
    onCrashMaxReached = vi.fn()
    onRecoveryRequested = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules recovery on first crash', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'chatgpt',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      result.current.handleCrashed()
    })

    expect(showWarning).toHaveBeenCalledWith('webview_crashed_retrying')
    expect(onRecoveryRequested).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onRecoveryRequested).toHaveBeenCalledTimes(1)
  })

  it('ignores clean-exit reason', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'chatgpt',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      result.current.handleCrashed({ reason: 'clean-exit' } as unknown as Event)
    })

    expect(showWarning).not.toHaveBeenCalled()
    expect(onRecoveryRequested).not.toHaveBeenCalled()
  })

  it('ignores killed reason', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'chatgpt',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      result.current.handleCrashed({ reason: 'killed' } as unknown as Event)
    })

    expect(showWarning).not.toHaveBeenCalled()
  })

  it('retries up to MAX_CRASH_RETRIES then calls onCrashMaxReached', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'chatgpt',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.handleCrashed()
      })
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(onRecoveryRequested).toHaveBeenCalledTimes(i + 1)
    }

    act(() => {
      result.current.handleCrashed()
    })

    expect(onCrashMaxReached).toHaveBeenCalledTimes(1)
    expect(onRecoveryRequested).toHaveBeenCalledTimes(3)
  })

  it('does not recover if webview changed', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'chatgpt',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      result.current.handleCrashed()
    })

    act(() => {
      activeWebviewRef.current = {} as WebviewElement
      vi.advanceTimersByTime(1000)
    })

    expect(onRecoveryRequested).not.toHaveBeenCalled()
  })

  it('resetCrashCounter clears timeout and resets count', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'chatgpt',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      result.current.handleCrashed()
      result.current.resetCrashCounter()
      vi.advanceTimersByTime(1000)
    })

    expect(onRecoveryRequested).not.toHaveBeenCalled()

    act(() => {
      result.current.handleCrashed()
    })
    expect(showWarning).toHaveBeenCalledTimes(2)
  })

  it('clearCrashRetryTimeout cancels pending recovery', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'chatgpt',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      result.current.handleCrashed()
      result.current.clearCrashRetryTimeout()
      vi.advanceTimersByTime(1000)
    })

    expect(onRecoveryRequested).not.toHaveBeenCalled()
  })
})
