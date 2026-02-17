import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useElementPicker } from '@src/features/automation/hooks/useElementPicker'


// Mock useToast
const mockToast = {
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn()
}
vi.mock('@src/app/providers', () => ({
    useToast: () => mockToast,
    useLanguage: () => ({ t: (key: string) => key })
}))

// Mock Logger
vi.mock('@src/utils/logger', () => ({
    Logger: {
        error: vi.fn(),
        log: vi.fn()
    }
}))

describe('useElementPicker Hook', () => {
    let mockWebview: any
    let mockElectron: any

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()

        mockWebview = {
            executeJavaScript: vi.fn(),
            getURL: vi.fn().mockReturnValue('https://example.com/foo')
        }

        mockElectron = {
            automation: {
                generatePickerScript: vi.fn().mockResolvedValue('// script')
            },
            saveAiConfig: vi.fn().mockResolvedValue(true)
        }
        window.electronAPI = mockElectron as any
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts picker successfully', async () => {
        const { result } = renderHook(() => useElementPicker(mockWebview))

        await act(async () => {
            await result.current.startPicker()
        })

        expect(mockElectron.automation.generatePickerScript).toHaveBeenCalled()
        expect(mockWebview.executeJavaScript).toHaveBeenCalledWith('// script')
        expect(result.current.isPickerActive).toBe(true)
        expect(mockToast.showInfo).toHaveBeenCalledWith('picker_started_hint')
    })

    it('handles successful picking', async () => {
        const { result } = renderHook(() => useElementPicker(mockWebview))

        await act(async () => {
            await result.current.startPicker()
        })

        // Mock polling result found
        const successResult = {
            type: 'result',
            data: JSON.stringify({ input: '#input', button: '#btn' })
        }
        mockWebview.executeJavaScript.mockResolvedValueOnce(successResult)

        // Advance timer to trigger polling
        await act(async () => {
            vi.advanceTimersByTime(500) // POLL_INTERVAL
        })

        // Wait for async operations after polling
        await act(async () => {
            // Let promises resolve
            await Promise.resolve()
        })

        expect(mockElectron.saveAiConfig).toHaveBeenCalledWith('example.com', { input: '#input', button: '#btn' })
        expect(mockToast.showSuccess).toHaveBeenCalledWith('sent_successfully')
        expect(result.current.isPickerActive).toBe(false)
    })

    it('handles cancellation from webview', async () => {
        const { result } = renderHook(() => useElementPicker(mockWebview))

        await act(async () => {
            await result.current.startPicker()
        })

        // Mock polling cancelled
        const cancelResult = { type: 'cancelled' }
        mockWebview.executeJavaScript.mockResolvedValueOnce(cancelResult)

        await act(async () => {
            vi.advanceTimersByTime(500)
        })

        expect(mockToast.showInfo).toHaveBeenCalledWith('picker_cancelled')
        expect(result.current.isPickerActive).toBe(false)
    })

    it('stops picker manually', async () => {
        const { result } = renderHook(() => useElementPicker(mockWebview))

        await act(async () => {
            await result.current.startPicker()
        })

        expect(result.current.isPickerActive).toBe(true)

        await act(async () => {
            await result.current.stopPicker()
        })

        expect(result.current.isPickerActive).toBe(false)
        expect(mockWebview.executeJavaScript).toHaveBeenCalledWith(expect.stringContaining('window._aiPickerCleanup'))
    })

    it('handles errors during start', async () => {
        mockElectron.automation.generatePickerScript.mockRejectedValue(new Error('Script error'))
        const { result } = renderHook(() => useElementPicker(mockWebview))

        await act(async () => {
            await result.current.startPicker()
        })

        expect(mockToast.showError).toHaveBeenCalledWith('picker_init_failed')
        expect(result.current.isPickerActive).toBe(false)
    })
})
