import { useWebviewLifecycle } from '@shared/hooks/webview/useWebviewLifecycle'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockWebview, mockRegisterWebview, mockShowWarning, mockT } from './mocks'

describe('useWebviewLifecycle - splash suppression after initial load', () => {
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

  it('keeps isLoading=true on first did-start-loading (initial load shows splash)', () => {
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

    expect(result.current.isLoading).toBe(true)

    act(() => {
      mockWebview._trigger('did-start-loading')
    })
    expect(result.current.isLoading).toBe(true)
  })

  it('does NOT re-show the splash on did-start-loading triggered after the first did-stop-loading', () => {
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
      mockWebview._trigger('did-stop-loading')
    })
    expect(result.current.isLoading).toBe(false)

    act(() => {
      mockWebview._trigger('did-start-loading')
    })
    expect(result.current.isLoading).toBe(false)

    act(() => {
      mockWebview._trigger('did-stop-loading')
    })
    expect(result.current.isLoading).toBe(false)
  })

  it('re-enables the splash when the webview is swapped (tab change / crash remount)', () => {
    const { result } = renderHook(() =>
      useWebviewLifecycle({
        currentAI: 'test-ai',
        t: mockT,
        showWarning: mockShowWarning,
        registerWebview: mockRegisterWebview
      })
    )

    const mockWebviewA = createMockWebview()
    act(() => {
      result.current.onWebviewRef(
        mockWebviewA as unknown as Parameters<typeof result.current.onWebviewRef>[0]
      )
    })
    act(() => {
      mockWebviewA._trigger('did-stop-loading')
    })
    expect(result.current.isLoading).toBe(false)

    const mockWebviewB = createMockWebview()
    act(() => {
      result.current.onWebviewRef(
        mockWebviewB as unknown as Parameters<typeof result.current.onWebviewRef>[0]
      )
    })

    act(() => {
      mockWebviewB._trigger('did-start-loading')
    })
    expect(result.current.isLoading).toBe(true)
  })

  it('still clears a previous error on subsequent did-start-loading (so the error overlay does not linger)', () => {
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
      mockWebview._trigger('did-stop-loading')
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()

    act(() => {
      mockWebview._trigger('did-fail-load', { errorCode: -1, errorDescription: 'Boom' })
    })
    expect(result.current.error).toBe('Boom')

    act(() => {
      mockWebview._trigger('did-start-loading')
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
