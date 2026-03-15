import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useWebviewLifecycle } from '@shared/hooks/webview/useWebviewLifecycle'

describe('useWebviewLifecycle', () => {
  const mockT = vi.fn((key) => key)
  const mockShowWarning = vi.fn()
  const mockRegisterWebview = vi.fn()

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

  const createMockWebview = () => {
    const listeners: Record<string, Function> = {}
    return {
      addEventListener: vi.fn((event, handler) => {
        listeners[event] = handler
      }),
      removeEventListener: vi.fn((event) => {
        delete listeners[event]
      }),
      reload: vi.fn(),
      executeJavaScript: vi.fn(),
      insertCSS: vi.fn().mockResolvedValue(undefined),
      getURL: vi.fn(() => 'https://example.com'),
      src: '',
      nodeName: 'WEBVIEW',
      _trigger: (event: string, ...args: any[]) => {
        if (listeners[event]) {
          listeners[event](...args)
        }
      }
    }
  }

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
      result.current.onWebviewRef(mockWebview as any)
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
    expect(result.current.isLoading).toBe(true)

    act(() => {
      mockWebview._trigger('did-fail-load', { errorCode: -100, errorDescription: 'Failed' })
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('Failed')
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
      result.current.onWebviewRef(mockWebview as any)
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
      result.current.onWebviewRef(mockWebview as any)
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
      result.current.onWebviewRef(mockWebview as any)
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
      result.current.onWebviewRef(mockWebview as any)
    })

    act(() => {
      mockWebview._trigger('did-fail-load', { errorCode: -3 })
    })

    expect(result.current.error).toBeNull()
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
      result.current.onWebviewRef(mockWebview as any)
    })

    await act(async () => {
      mockWebview._trigger('dom-ready')
    })

    expect(mockWebview.insertCSS).toHaveBeenCalledTimes(1)
    expect(mockWebview.insertCSS).toHaveBeenCalledWith(
      expect.stringContaining('::-webkit-scrollbar')
    )
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
      result.current.onWebviewRef(mockWebview as any)
    })

    const controller =
      mockRegisterWebview.mock.calls[mockRegisterWebview.mock.calls.length - 1]?.[0]

    act(() => {
      result.current.onWebviewRef(null)
    })

    expect(controller.executeJavaScript('1 + 1')).toBeUndefined()
  })
})
