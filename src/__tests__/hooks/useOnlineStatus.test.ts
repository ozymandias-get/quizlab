import { useOnlineStatus } from '@app/hooks/useOnlineStatus'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockShowSuccess = vi.fn()
const mockShowWarning = vi.fn()

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showSuccess: mockShowSuccess,
    showWarning: mockShowWarning
  })
}))

describe('useOnlineStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
  })

  it('should return initial online status', () => {
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('should update status and show warning when going offline', () => {
    const { result } = renderHook(() => useOnlineStatus())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
    expect(mockShowWarning).toHaveBeenCalledWith('connection_lost')
  })

  it('should update status and show success when coming back online', () => {
    const { result } = renderHook(() => useOnlineStatus())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current).toBe(true)
    expect(mockShowSuccess).toHaveBeenCalledWith('connection_restored')
  })

  it('should initialize with correct status if offline initially', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })
})
