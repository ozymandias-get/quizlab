import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOnlineStatus } from '@src/hooks/useOnlineStatus'

// Mock dependencies
const mockShowSuccess = vi.fn()
const mockShowWarning = vi.fn()

vi.mock('@src/app/providers', () => ({
    useToast: () => ({
        showSuccess: mockShowSuccess,
        showWarning: mockShowWarning,
    }),
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('useOnlineStatus Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset online status to true
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

        // First go offline
        act(() => {
            window.dispatchEvent(new Event('offline'))
        })
        expect(result.current).toBe(false)

        // Then go online
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
