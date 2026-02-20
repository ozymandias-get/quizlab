import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useWebviewMount } from '@src/hooks/useWebviewMount'

describe('useWebviewMount', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        // Clean up window properties
        delete (window as any).requestIdleCallback
        delete (window as any).cancelIdleCallback
    })

    it('should initialize as false', () => {
        const { result } = renderHook(() => useWebviewMount())
        expect(result.current).toBe(false)
    })

    it('should use requestIdleCallback when available', () => {
        const requestIdleCallbackMock = vi.fn((cb) => {
            // Simulate idle callback
            setTimeout(cb, 10)
            return 1
        })
        const cancelIdleCallbackMock = vi.fn()

        Object.assign(window, {
            requestIdleCallback: requestIdleCallbackMock,
            cancelIdleCallback: cancelIdleCallbackMock
        })

        const { result } = renderHook(() => useWebviewMount())

        expect(result.current).toBe(false)
        expect(requestIdleCallbackMock).toHaveBeenCalled()

        // Advance timers to trigger the callback
        act(() => {
            vi.advanceTimersByTime(20)
        })

        expect(result.current).toBe(true)
    })

    it('should callback properly when requestIdleCallback is used', () => {
        const requestIdleCallbackMock = vi.fn((cb) => {
            // Immediately execute for this test case simplified
            cb()
            return 123
        })
        Object.assign(window, {
            requestIdleCallback: requestIdleCallbackMock,
        })

        const { result } = renderHook(() => useWebviewMount())
        expect(result.current).toBe(true)
    })

    it('should fallback to setTimeout when requestIdleCallback is missing', () => {
        // Ensure requestIdleCallback is undefined
        (window as any).requestIdleCallback = undefined

        const { result } = renderHook(() => useWebviewMount())

        expect(result.current).toBe(false)

        // Advance timers by 120ms (the fallback timeout)
        act(() => {
            vi.advanceTimersByTime(120)
        })

        expect(result.current).toBe(true)
    })

    it('should clean up on unmount (cancelIdleCallback)', () => {
        const cancelIdleCallbackMock = vi.fn()
        Object.assign(window, {
            requestIdleCallback: vi.fn(() => 123),
            cancelIdleCallback: cancelIdleCallbackMock
        })

        const { unmount } = renderHook(() => useWebviewMount())

        unmount()

        expect(cancelIdleCallbackMock).toHaveBeenCalledWith(123)
    })

    it('should clean up on unmount (clearTimeout)', () => {
        (window as any).requestIdleCallback = undefined
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

        const { unmount } = renderHook(() => useWebviewMount())

        unmount()

        expect(clearTimeoutSpy).toHaveBeenCalled()
    })
})
