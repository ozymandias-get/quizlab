import { useWebviewLifecycle } from '@shared/hooks/webview/useWebviewLifecycle'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockWebview, mockRegisterWebview, mockShowWarning, mockT } from './mocks'

describe('useWebviewLifecycle - crash recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockT.mockClear()
    mockShowWarning.mockClear()
    mockRegisterWebview.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should handle retry logic on crash', () => {
    const { result } = renderHook(() =>
      useWebviewLifecycle({
        currentAI: 'test-ai',
        t: mockT,
        showWarning: mockShowWarning,
        registerWebview: mockRegisterWebview
      })
    )

    const mockWebview = createMockWebview()
    act(() => {
      result.current.onWebviewRef(
        mockWebview as unknown as Parameters<typeof result.current.onWebviewRef>[0]
      )
    })

    act(() => {
      mockWebview._trigger('render-process-gone')
    })

    expect(mockShowWarning).toHaveBeenCalledWith('webview_crashed_retrying')
    expect(mockWebview.reload).not.toHaveBeenCalled()

    act(() => {
      vi.runAllTimers()
    })

    expect(mockWebview.reload).toHaveBeenCalled()
  })

  it('should request webview remount when crash recovery callback is provided', () => {
    const onCrashRecoveryRequested = vi.fn()
    const { result } = renderHook(() =>
      useWebviewLifecycle({
        currentAI: 'test-ai',
        t: mockT,
        showWarning: mockShowWarning,
        registerWebview: mockRegisterWebview,
        onCrashRecoveryRequested
      })
    )

    const mockWebview = createMockWebview()
    act(() => {
      result.current.onWebviewRef(
        mockWebview as unknown as Parameters<typeof result.current.onWebviewRef>[0]
      )
    })

    act(() => {
      mockWebview._trigger('render-process-gone', { reason: 'crashed' })
      vi.runAllTimers()
    })

    expect(onCrashRecoveryRequested).toHaveBeenCalledTimes(1)
    expect(mockWebview.reload).not.toHaveBeenCalled()
  })

  it('should ignore clean renderer exits', () => {
    const { result } = renderHook(() =>
      useWebviewLifecycle({
        currentAI: 'test-ai',
        t: mockT,
        showWarning: mockShowWarning,
        registerWebview: mockRegisterWebview
      })
    )

    const mockWebview = createMockWebview()
    act(() => {
      result.current.onWebviewRef(
        mockWebview as unknown as Parameters<typeof result.current.onWebviewRef>[0]
      )
    })

    act(() => {
      mockWebview._trigger('render-process-gone', { reason: 'clean-exit' })
      vi.runAllTimers()
    })

    expect(mockShowWarning).not.toHaveBeenCalledWith('webview_crashed_retrying')
    expect(mockWebview.reload).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('should show max retries error if crashes continue', () => {
    const { result } = renderHook(() =>
      useWebviewLifecycle({
        currentAI: 'test-ai',
        t: mockT,
        showWarning: mockShowWarning,
        registerWebview: mockRegisterWebview
      })
    )

    const mockWebview = createMockWebview()
    act(() => {
      result.current.onWebviewRef(
        mockWebview as unknown as Parameters<typeof result.current.onWebviewRef>[0]
      )
    })

    for (let i = 0; i < 3; i++) {
      act(() => {
        mockWebview._trigger('render-process-gone')
        vi.runAllTimers()
      })
    }

    act(() => {
      mockWebview._trigger('render-process-gone')
    })

    expect(result.current.error).toBe('webview_crashed_max')
  })
})
