import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useWebviewCrasher } from '@shared/hooks/webview/useWebviewCrasher'

import type { WebviewElement } from '@shared-core/types/webview'

describe('useWebviewCrasher Hook', () => {
  let activeWebview: WebviewElement | null
  let activeWebviewRef: any
  let showWarning: any
  let onCrashMaxReached: any
  let onRecoveryRequested: any

  beforeEach(() => {
    vi.useFakeTimers()
    activeWebview = { id: 'mock-webview' } as unknown as WebviewElement
    activeWebviewRef = { current: activeWebview }
    showWarning = vi.fn()
    onCrashMaxReached = vi.fn()
    onRecoveryRequested = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should ignore non-crash exit reasons', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'gemini',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      result.current.handleCrashed({ reason: 'clean-exit' } as any)
      result.current.handleCrashed({ reason: 'killed' } as any)
    })

    expect(showWarning).not.toHaveBeenCalled()
    expect(onRecoveryRequested).not.toHaveBeenCalled()
    expect(onCrashMaxReached).not.toHaveBeenCalled()
  })

  it('should set recovery timer and show warning on a valid crash', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'gemini',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      result.current.handleCrashed({ reason: 'crashed' } as any)
    })

    expect(showWarning).toHaveBeenCalledWith('webview_crashed_retrying')
    expect(onRecoveryRequested).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onRecoveryRequested).toHaveBeenCalledTimes(1)
    expect(onCrashMaxReached).not.toHaveBeenCalled()
  })

  it('should cancel recovery and trigger maximum crash limits on reaching MAX_CRASH_RETRIES', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'gemini',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      // First crash
      result.current.handleCrashed({ reason: 'crashed' } as any)
      vi.advanceTimersByTime(1000)
      // Second crash
      result.current.handleCrashed({ reason: 'crashed' } as any)
      vi.advanceTimersByTime(1000)
      // Third crash
      result.current.handleCrashed({ reason: 'crashed' } as any)
      vi.advanceTimersByTime(1000)
    })

    expect(onRecoveryRequested).toHaveBeenCalledTimes(3)
    expect(onCrashMaxReached).not.toHaveBeenCalled()

    act(() => {
      // Fourth crash -> reaches limit
      result.current.handleCrashed({ reason: 'crashed' } as any)
    })

    expect(onCrashMaxReached).toHaveBeenCalledTimes(1)
    expect(onRecoveryRequested).toHaveBeenCalledTimes(3) // No additional recovery triggered
  })

  it('should not recover if active webview ref changes during delay', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'gemini',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      result.current.handleCrashed({ reason: 'crashed' } as any)
      // Simulate webview ref change
      activeWebviewRef.current = { id: 'new-webview' } as unknown as WebviewElement
      vi.advanceTimersByTime(1000)
    })

    expect(onRecoveryRequested).not.toHaveBeenCalled()
  })

  it('should not recover if recovery timer is cleared', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'gemini',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      result.current.handleCrashed({ reason: 'crashed' } as any)
    })

    act(() => {
      result.current.clearCrashRetryTimeout()
    })

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onRecoveryRequested).not.toHaveBeenCalled()
  })

  it('should reset crash counter when resetCrashCounter is invoked', () => {
    const { result } = renderHook(() =>
      useWebviewCrasher({
        activeWebviewRef,
        currentAI: 'gemini',
        showWarning,
        onCrashMaxReached,
        onRecoveryRequested
      })
    )

    act(() => {
      result.current.handleCrashed({ reason: 'crashed' } as any)
      vi.advanceTimersByTime(1000)
      result.current.handleCrashed({ reason: 'crashed' } as any)
      vi.advanceTimersByTime(1000)
    })

    expect(onRecoveryRequested).toHaveBeenCalledTimes(2)

    act(() => {
      result.current.resetCrashCounter()
    })

    act(() => {
      result.current.handleCrashed({ reason: 'crashed' } as any)
      vi.advanceTimersByTime(1000)
      result.current.handleCrashed({ reason: 'crashed' } as any)
      vi.advanceTimersByTime(1000)
    })

    expect(onRecoveryRequested).toHaveBeenCalledTimes(4)
    expect(onCrashMaxReached).not.toHaveBeenCalled()
  })
})
