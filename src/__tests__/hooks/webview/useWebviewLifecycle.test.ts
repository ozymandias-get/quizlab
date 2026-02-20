import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useWebviewLifecycle } from '@src/hooks/webview/useWebviewLifecycle'

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

    // Helper to create a mock webview element
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
            // Methods required by WebviewElement interface (partial mock)
            src: '',
            nodeName: 'WEBVIEW',
            // Helper to trigger events
            _trigger: (event: string, ...args: any[]) => {
                if (listeners[event]) {
                    listeners[event](...args)
                }
            }
        }
    }

    it('should initialize with loading state', () => {
        const { result } = renderHook(() => useWebviewLifecycle({
            currentAI: 'test-ai',
            t: mockT,
            showWarning: mockShowWarning,
            registerWebview: mockRegisterWebview
        }))

        expect(result.current.isLoading).toBe(true)
        expect(result.current.error).toBeNull()
    })

    it('should handle webview events', () => {
        const { result } = renderHook(() => useWebviewLifecycle({
            currentAI: 'test-ai',
            t: mockT,
            showWarning: mockShowWarning,
            registerWebview: mockRegisterWebview
        }))

        const mockWebview = createMockWebview()

        // Simulate ref callback
        act(() => {
            result.current.onWebviewRef(mockWebview as any)
        })

        // Check if event listeners were added
        expect(mockWebview.addEventListener).toHaveBeenCalledWith('did-start-loading', expect.any(Function))
        expect(mockWebview.addEventListener).toHaveBeenCalledWith('did-stop-loading', expect.any(Function))
        expect(mockWebview.addEventListener).toHaveBeenCalledWith('did-fail-load', expect.any(Function))

        // Trigger stop loading
        act(() => {
            mockWebview._trigger('did-stop-loading')
        })
        expect(result.current.isLoading).toBe(false)

        // Trigger start loading
        act(() => {
            mockWebview._trigger('did-start-loading')
        })
        expect(result.current.isLoading).toBe(true)

        // Trigger fail load
        act(() => {
            mockWebview._trigger('did-fail-load', { errorCode: -100, errorDescription: 'Failed' })
        })
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBe('Failed')
    })

    it('should handle retry logic on crash', () => {
        const { result } = renderHook(() => useWebviewLifecycle({
            currentAI: 'test-ai',
            t: mockT,
            showWarning: mockShowWarning,
            registerWebview: mockRegisterWebview
        }))

        const mockWebview = createMockWebview()
        act(() => {
            result.current.onWebviewRef(mockWebview as any)
        })

        // Trigger crash
        act(() => {
            mockWebview._trigger('render-process-gone')
        })

        expect(mockShowWarning).toHaveBeenCalledWith('webview_crashed_retrying')
        expect(mockWebview.reload).not.toHaveBeenCalled() // Waits for delay

        // Fast-forward time
        act(() => {
            vi.runAllTimers()
        })

        expect(mockWebview.reload).toHaveBeenCalled()
    })

    it('should show max retries error if crashes continue', () => {
        const { result } = renderHook(() => useWebviewLifecycle({
            currentAI: 'test-ai',
            t: mockT,
            showWarning: mockShowWarning,
            registerWebview: mockRegisterWebview
        }))

        const mockWebview = createMockWebview()
        act(() => {
            result.current.onWebviewRef(mockWebview as any)
        })

        // Retry 3 times
        for (let i = 0; i < 3; i++) {
            act(() => {
                mockWebview._trigger('render-process-gone')
                vi.runAllTimers()
            })
        }

        // 4th crash
        act(() => {
            mockWebview._trigger('render-process-gone')
        })

        expect(result.current.error).toBe('webview_crashed_max')
    })

    it('should register webview methods', () => {
        renderHook(() => useWebviewLifecycle({
            currentAI: 'test-ai',
            t: mockT,
            showWarning: mockShowWarning,
            registerWebview: mockRegisterWebview
        }))

        // Initially called with null (cleanup/init) or methods once ref is available. 
        // Wait, the hook calls registerWebview(methods) when ref is available.
        // And registerWebview(null) on unmount.

        // Let's create a ref
        const { result } = renderHook(() => useWebviewLifecycle({
            currentAI: 'test-ai',
            t: mockT,
            showWarning: mockShowWarning,
            registerWebview: mockRegisterWebview
        }))
        const mockWebview = createMockWebview()
        act(() => {
            result.current.onWebviewRef(mockWebview as any)
        })

        expect(mockRegisterWebview).toHaveBeenCalledWith(expect.objectContaining({
            executeJavaScript: expect.any(Function),
            reload: expect.any(Function)
        }))
    })

    it('should ignore aborted errors', () => {
        const { result } = renderHook(() => useWebviewLifecycle({
            currentAI: 'test-ai',
            t: mockT,
            showWarning: mockShowWarning,
            registerWebview: mockRegisterWebview
        }))

        const mockWebview = createMockWebview()
        act(() => {
            result.current.onWebviewRef(mockWebview as any)
        })

        // Trigger aborted error
        act(() => {
            mockWebview._trigger('did-fail-load', { errorCode: -3 })
        })

        expect(result.current.error).toBeNull()
    })
})
