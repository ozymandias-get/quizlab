import { useWebviewLifecycle } from '@shared/hooks/webview/useWebviewLifecycle'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockWebview, mockRegisterWebview, mockShowWarning, mockT } from './mocks'

describe('useWebviewLifecycle - lifecycle', () => {
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

  it('should initialize with loading state', () => {
    const { result } = renderHook(() =>
      useWebviewLifecycle({
        currentAI: 'test-ai',
        t: mockT,
        showWarning: mockShowWarning,
        registerWebview: mockRegisterWebview
      })
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('should handle webview events', () => {
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

    expect(mockWebview.addEventListener).toHaveBeenCalledWith(
      'did-start-loading',
      expect.any(Function)
    )
    expect(mockWebview.addEventListener).toHaveBeenCalledWith(
      'did-stop-loading',
      expect.any(Function)
    )
    expect(mockWebview.addEventListener).toHaveBeenCalledWith('did-fail-load', expect.any(Function))
    expect(mockWebview.addEventListener).toHaveBeenCalledWith('dom-ready', expect.any(Function))

    act(() => {
      mockWebview._trigger('did-stop-loading')
    })
    expect(result.current.isLoading).toBe(false)

    act(() => {
      mockWebview._trigger('did-start-loading')
    })
    expect(result.current.isLoading).toBe(false)

    act(() => {
      mockWebview._trigger('did-fail-load', { errorCode: -100, errorDescription: 'Failed' })
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should register webview methods', () => {
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

    expect(mockRegisterWebview).toHaveBeenCalledWith(
      expect.objectContaining({
        executeJavaScript: expect.any(Function),
        reload: expect.any(Function)
      })
    )
  })

  it('should ignore aborted errors', () => {
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
      mockWebview._trigger('did-fail-load', { errorCode: -3 })
    })

    expect(result.current.error).toBeNull()
  })

  it('should ignore all transient error codes (-2, -100 through -104)', () => {
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

    const transientCodes = [-2, -3, -100, -101, -102, -103, -104]
    for (const code of transientCodes) {
      act(() => {
        mockWebview._trigger('did-fail-load', {
          errorCode: code,
          errorDescription: `Error ${code}`
        })
      })
      expect(result.current.error).toBeNull()
    }
  })

  it('should surface non-transient error codes', () => {
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
      mockWebview._trigger('did-fail-load', {
        errorCode: -1,
        errorDescription: 'net::ERR_NAME_NOT_RESOLVED'
      })
    })
    expect(result.current.error).toBe('net::ERR_NAME_NOT_RESOLVED')
  })

  it('should inject scrollbar styles on dom-ready', async () => {
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

    await act(async () => {
      mockWebview._trigger('dom-ready')
    })

    expect(mockWebview.insertCSS).toHaveBeenCalledTimes(1)
    expect(mockWebview.insertCSS).toHaveBeenCalledWith(
      expect.stringContaining('::-webkit-scrollbar')
    )
  })

  it('reports URL changes from dom-ready and in-page navigation', async () => {
    const onUrlChange = vi.fn()
    const { result } = renderHook(() =>
      useWebviewLifecycle({
        currentAI: 'test-ai',
        t: mockT,
        showWarning: mockShowWarning,
        registerWebview: mockRegisterWebview,
        onUrlChange
      })
    )

    const mockWebview = createMockWebview()
    act(() => {
      result.current.onWebviewRef(
        mockWebview as unknown as Parameters<typeof result.current.onWebviewRef>[0]
      )
    })

    await act(async () => {
      mockWebview._trigger('dom-ready')
      mockWebview._trigger('did-navigate-in-page', { url: 'https://example.com/chat' })
    })

    expect(onUrlChange).toHaveBeenNthCalledWith(1, 'https://example.com')
    expect(onUrlChange).toHaveBeenNthCalledWith(2, 'https://example.com/chat')
  })

  it('notifies subscribeWebviewElement on attach and detach', () => {
    const { result } = renderHook(() =>
      useWebviewLifecycle({
        currentAI: 'test-ai',
        t: mockT,
        showWarning: mockShowWarning,
        registerWebview: mockRegisterWebview
      })
    )

    const mockWebview = createMockWebview()
    const listener = vi.fn()

    act(() => {
      result.current.onWebviewRef(
        mockWebview as unknown as Parameters<typeof result.current.onWebviewRef>[0]
      )
    })

    const controller =
      mockRegisterWebview.mock.calls[mockRegisterWebview.mock.calls.length - 1]?.[0]
    expect(controller?.subscribeWebviewElement).toEqual(expect.any(Function))

    act(() => {
      controller.subscribeWebviewElement(listener)
    })

    expect(listener).toHaveBeenLastCalledWith(
      mockWebview as unknown as Parameters<typeof listener>[0]
    )

    listener.mockClear()

    act(() => {
      result.current.onWebviewRef(null)
    })

    expect(listener).toHaveBeenLastCalledWith(null)
  })

  it('returns undefined from controller access after the webview ref is cleared', () => {
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

    const controller =
      mockRegisterWebview.mock.calls[mockRegisterWebview.mock.calls.length - 1]?.[0]

    act(() => {
      result.current.onWebviewRef(null)
    })

    expect(controller.executeJavaScript('1 + 1')).toBeUndefined()
  })
})
