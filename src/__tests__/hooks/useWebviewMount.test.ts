import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useWebviewMount } from '@shared/hooks/useWebviewMount'

describe('useWebviewMount', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete (window as Partial<Window & { requestIdleCallback?: any }>).requestIdleCallback
    delete (window as Partial<Window & { cancelIdleCallback?: any }>).cancelIdleCallback
  })

  it('should initialize as false', () => {
    const { result } = renderHook(() => useWebviewMount())
    expect(result.current).toBe(false)
  })

  it('should use requestIdleCallback when available', () => {
    const requestIdleCallbackMock = vi.fn((cb) => {
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

    act(() => {
      vi.advanceTimersByTime(20)
    })

    expect(result.current).toBe(true)
  })

  it('should callback properly when requestIdleCallback is used', () => {
    const requestIdleCallbackMock = vi.fn((cb) => {
      cb()
      return 123
    })
    Object.assign(window, {
      requestIdleCallback: requestIdleCallbackMock
    })

    const { result } = renderHook(() => useWebviewMount())
    expect(result.current).toBe(true)
  })

  it('should fallback to setTimeout when requestIdleCallback is missing', () => {
    ;(window as Partial<Window & { requestIdleCallback?: any }>).requestIdleCallback = undefined

    const { result } = renderHook(() => useWebviewMount())

    expect(result.current).toBe(false)

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
    ;(window as Partial<Window & { requestIdleCallback?: any }>).requestIdleCallback = undefined
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    const { unmount } = renderHook(() => useWebviewMount())

    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})
