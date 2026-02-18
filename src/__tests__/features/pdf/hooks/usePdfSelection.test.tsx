import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePdfSelection } from '@features/pdf/hooks/usePdfSelection'
import React from 'react'
import { STORAGE_KEYS } from '@src/constants/storageKeys'

// Mock Toast
const mockShowError = vi.fn()
const mockShowSuccess = vi.fn()
vi.mock('@src/app/providers/ToastContext', () => ({
    useToast: () => ({
        showError: mockShowError,
        showSuccess: mockShowSuccess
    })
}))

// Mock Language
const mockT = vi.fn((key) => key)
vi.mock('@src/app/providers/LanguageContext', () => ({
    useLanguage: () => ({
        t: mockT
    })
}))

// Mock API Hooks
const mockSelectPdfMutate = vi.fn()
const mockRegisterPdfPathMutate = vi.fn()

vi.mock('@platform/electron/api/usePdfApi', () => ({
    useSelectPdf: () => ({
        mutateAsync: mockSelectPdfMutate
    }),
    useRegisterPdfPath: () => ({
        mutateAsync: mockRegisterPdfPathMutate
    })
}))

// Mock LocalStorage
const localStorageMock = (function () {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value.toString();
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Wrapper
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
}

describe('usePdfSelection', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        localStorageMock.clear()
    })

    it('should select PDF successfully', async () => {
        const mockPdfFile = { name: 'test.pdf', path: '/path/to/test.pdf' }
        mockSelectPdfMutate.mockResolvedValue(mockPdfFile)

        const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

        await act(async () => {
            await result.current.handleSelectPdf()
        })

        await waitFor(() => {
            expect(result.current.pdfFile).toEqual(mockPdfFile)
        })

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            STORAGE_KEYS.LAST_PDF_READING,
            expect.stringContaining('test.pdf')
        )
    })

    it('should handle PDF selection failure', async () => {
        // Mock Logger to suppress console output
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

        mockSelectPdfMutate.mockRejectedValue(new Error('Selection cancelled'))
        const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

        await act(async () => {
            await result.current.handleSelectPdf()
        })

        expect(result.current.pdfFile).toBeNull()
        errorSpy.mockRestore()
    })

    it('should handle PDF drop successfully', async () => {
        const mockFile = { name: 'dropped.pdf', type: 'application/pdf', path: '/dropped/path.pdf' }
        const mockResult = { name: 'dropped.pdf', path: '/dropped/path.pdf' }
        mockRegisterPdfPathMutate.mockResolvedValue(mockResult)

        const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

        await act(async () => {
            await result.current.handlePdfDrop(mockFile as any)
        })

        expect(mockRegisterPdfPathMutate).toHaveBeenCalledWith('/dropped/path.pdf')
        // Wait for state
        await waitFor(() => {
            expect(result.current.pdfFile).toEqual(mockResult)
        })
        expect(mockShowSuccess).toHaveBeenCalled()
    })

    it('should reject invalid file types on drop', async () => {
        const mockFile = { name: 'image.png', type: 'image/png', path: '/image.png' }
        const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

        await act(async () => {
            await result.current.handlePdfDrop(mockFile as any)
        })

        expect(mockShowError).toHaveBeenCalledWith('error_invalid_pdf')
        expect(mockRegisterPdfPathMutate).not.toHaveBeenCalled()
    })

    it('should resume last PDF from localStorage', async () => {
        const storedData = JSON.stringify({ name: 'resumed.pdf', path: '/resume/path.pdf', page: 5 })
        localStorageMock.getItem.mockReturnValue(storedData)

        const mockResult = { name: 'resumed.pdf', path: '/resume/path.pdf' }
        mockRegisterPdfPathMutate.mockResolvedValue(mockResult)

        const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

        await act(async () => {
            await result.current.resumeLastPdf()
        })

        await waitFor(() => {
            expect(mockRegisterPdfPathMutate).toHaveBeenCalledWith('/resume/path.pdf')
            expect(result.current.pdfFile).toEqual(mockResult)
        })
    })

    it('should handle resume failure (invalid path)', async () => {
        // Mock Logger
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

        const storedData = JSON.stringify({ name: 'fail.pdf', path: '/fail/path.pdf' })
        localStorageMock.getItem.mockReturnValue(storedData)

        mockRegisterPdfPathMutate.mockRejectedValue(new Error('File not found'))

        const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

        await act(async () => {
            await result.current.resumeLastPdf()
        })

        await waitFor(() => {
            expect(mockShowError).toHaveBeenCalledWith('error_pdf_load')
            expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LAST_PDF_READING)
        })
        errorSpy.mockRestore()
    })

    it('should retrieve last reading info', async () => {
        const data = { name: 'info.pdf', path: '/info.pdf', page: 10, totalPages: 20 }
        localStorageMock.getItem.mockReturnValue(JSON.stringify(data))

        const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

        const info = result.current.getLastReadingInfo()
        expect(info).toEqual(data)
    })
})

