import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useElementPicker } from '@features/automation/hooks/useElementPicker'

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

// Mock useAiApi and useAutomationApi hooks
const mockSaveAiConfigMutate = vi.fn()
const mockGeneratePickerScriptMutate = vi.fn()

vi.mock('@platform/electron/api/useAiApi', () => ({
    useSaveAiConfig: () => ({
        mutateAsync: mockSaveAiConfigMutate
    })
}))

vi.mock('@platform/electron/api/useAutomationApi', () => ({
    useGeneratePickerScript: () => ({
        mutateAsync: mockGeneratePickerScriptMutate
    })
}))

describe('useElementPicker Hook', () => {
    let mockWebview: any

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()

        mockWebview = {
            executeJavaScript: vi.fn(),
            getURL: vi.fn().mockReturnValue('https://example.com/foo')
        }

        // Setup default mocks
        mockGeneratePickerScriptMutate.mockResolvedValue('// script')
        mockSaveAiConfigMutate.mockResolvedValue(true)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts picker successfully', async () => {
        const { result } = renderHook(() => useElementPicker(mockWebview))

        await act(async () => {
            await result.current.startPicker()
        })

        expect(mockGeneratePickerScriptMutate).toHaveBeenCalled()
        expect(mockWebview.executeJavaScript).toHaveBeenCalledWith('// script')
        expect(result.current.isPickerActive).toBe(true)
        expect(mockToast.showInfo).toHaveBeenCalledWith('picker_started_hint')
    })
})

