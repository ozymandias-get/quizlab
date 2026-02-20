import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AiProvider, useAi } from '@src/app/providers/AiContext'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock dependencies
const mockShowSuccess = vi.fn()
const mockShowWarning = vi.fn()
const mockShowError = vi.fn()

vi.mock('@src/app/providers/ToastContext', () => ({
    useToast: () => ({
        showSuccess: mockShowSuccess,
        showWarning: mockShowWarning,
        showError: mockShowError
    })
}))

const mockSendText = vi.fn()
const mockSendImage = vi.fn()

vi.mock('@src/hooks', () => ({
    useLocalStorage: (_key: string, initial: any) => {
        const [val, setVal] = React.useState(initial)
        return [val, setVal]
    },
    useLocalStorageString: (_key: string, initial: any) => {
        const [val, setVal] = React.useState(initial)
        return [val, setVal]
    },
    useLocalStorageBoolean: (_key: string, initial: any) => {
        const [val, setVal] = React.useState(initial)
        const toggle = () => setVal(!val)
        return [val, setVal, toggle]
    }
}))

vi.mock('@features/ai/hooks/useAiSender', () => ({
    useAiSender: () => ({
        sendTextToAI: mockSendText,
        sendImageToAI: mockSendImage
    })
}))

vi.mock('@src/utils/logger', () => ({
    Logger: { error: vi.fn() }
}))

describe('AiContext', () => {
    const originalElectronAPI = window.electronAPI
    const mockGetAiRegistry = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()

        window.electronAPI = {
            getAiRegistry: mockGetAiRegistry
        } as any

        // Default registry response
        mockGetAiRegistry.mockResolvedValue({
            aiRegistry: {
                'chatgpt': { id: 'chatgpt', name: 'ChatGPT' },
                'claude': { id: 'claude', name: 'Claude' }
            },
            defaultAiId: 'chatgpt',
            allAiIds: ['chatgpt', 'claude'],
            chromeUserAgent: 'Mozilla/5.0'
        })
    })

    afterEach(() => {
        window.electronAPI = originalElectronAPI
    })

    // Wrapper includes QueryClientProvider so React Query hooks inside AiProvider work
    const createWrapper = () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })
        return ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                <AiProvider>{children}</AiProvider>
            </QueryClientProvider>
        )
    }

    it('loads registry on mount', async () => {
        const { result } = renderHook(() => useAi(), { wrapper: createWrapper() })

        await waitFor(() => {
            expect(result.current.isRegistryLoaded).toBe(true)
        })

        expect(mockGetAiRegistry).toHaveBeenCalled()
        expect(result.current.aiSites['chatgpt']).toBeDefined()
        expect(result.current.currentAI).toBe('chatgpt')
    })

    it('manages tabs (add, switch)', async () => {
        const { result } = renderHook(() => useAi(), { wrapper: createWrapper() })
        await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

        const initialTabId = result.current.activeTabId

        act(() => {
            result.current.addTab('claude')
        })

        expect(result.current.tabs).toHaveLength(2)
        expect(result.current.activeTabId).not.toBe(initialTabId)
        expect(result.current.currentAI).toBe('claude')

        // Switch back
        act(() => {
            result.current.setActiveTab(initialTabId)
        })
        expect(result.current.activeTabId).toBe(initialTabId)
        expect(result.current.currentAI).toBe('chatgpt')
    })

    it('closes tabs and prevents closing the last one', async () => {
        const { result } = renderHook(() => useAi(), { wrapper: createWrapper() })
        await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

        // Add a tab first
        act(() => {
            result.current.addTab('claude')
        })
        expect(result.current.tabs).toHaveLength(2)

        const tabToClose = result.current.activeTabId

        // Close active tab
        act(() => {
            result.current.closeTab(tabToClose)
        })

        expect(result.current.tabs).toHaveLength(1)
        expect(result.current.activeTabId).not.toBe(tabToClose)

        // Try closing the last remaining tab
        const lastTab = result.current.activeTabId
        act(() => {
            result.current.closeTab(lastTab)
        })
        expect(result.current.tabs).toHaveLength(1) // Should still be 1
    })

    it('wraps sending text with toast notifications', async () => {
        const { result } = renderHook(() => useAi(), { wrapper: createWrapper() })
        await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

        mockSendText.mockResolvedValue({ success: true })

        await act(async () => {
            await result.current.sendTextToAI('hello')
        })

        expect(mockSendText).toHaveBeenCalledWith('hello')
        // Success doesn't trigger toast for text
        expect(mockShowSuccess).not.toHaveBeenCalled()

        // Fail case
        mockSendText.mockResolvedValue({ success: false, error: 'fail' })
        await act(async () => {
            await result.current.sendTextToAI('fail')
        })
        expect(mockShowWarning).toHaveBeenCalledWith('error_fail')
    })

    it('wraps sending image with toast notifications', async () => {
        const { result } = renderHook(() => useAi(), { wrapper: createWrapper() })
        await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

        mockSendImage.mockResolvedValue({ success: true })

        await act(async () => {
            await result.current.sendImageToAI('data:image...')
        })
        expect(mockShowSuccess).toHaveBeenCalledWith('sent_successfully')
    })
})
