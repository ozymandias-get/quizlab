import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AiProvider, useAi } from '@app/providers/AiContext'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock dependencies
const mockShowSuccess = vi.fn()
const mockShowWarning = vi.fn()
const mockShowError = vi.fn()

vi.mock('@app/providers/ToastContext', () => ({
    useToast: () => ({
        showSuccess: mockShowSuccess,
        showWarning: mockShowWarning,
        showError: mockShowError
    })
}))

const mockSendText = vi.fn()
const mockSendImage = vi.fn()

vi.mock('@shared/hooks', () => ({
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

vi.mock('@shared/lib/logger', () => ({
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

        expect(result.current.tabs).toHaveLength(0)
        expect(result.current.activeTabId).toBe('')

        act(() => {
            result.current.addTab('chatgpt')
        })

        expect(result.current.tabs).toHaveLength(1)
        const firstTabId = result.current.activeTabId
        expect(result.current.currentAI).toBe('chatgpt')

        act(() => {
            result.current.addTab('claude')
        })

        expect(result.current.tabs).toHaveLength(2)
        expect(result.current.activeTabId).not.toBe(firstTabId)
        expect(result.current.currentAI).toBe('claude')

        act(() => {
            result.current.setActiveTab(firstTabId)
        })

        expect(result.current.activeTabId).toBe(firstTabId)
        expect(result.current.currentAI).toBe('chatgpt')
    })

    it('opens the requested AI workspace and bumps the reveal nonce', async () => {
        const { result } = renderHook(() => useAi(), { wrapper: createWrapper() })
        await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

        act(() => {
            result.current.openAiWorkspace('chatgpt')
        })

        const firstNonce = result.current.aiViewRequestNonce
        const firstTabId = result.current.activeTabId

        expect(result.current.tabs).toHaveLength(1)
        expect(result.current.currentAI).toBe('chatgpt')
        expect(firstNonce).toBeGreaterThan(0)

        act(() => {
            result.current.openAiWorkspace('chatgpt')
        })

        expect(result.current.tabs).toHaveLength(1)
        expect(result.current.activeTabId).toBe(firstTabId)
        expect(result.current.aiViewRequestNonce).toBeGreaterThan(firstNonce)
    })

    it('closes tabs and returns to the home state when the last tab closes', async () => {
        const { result } = renderHook(() => useAi(), { wrapper: createWrapper() })
        await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

        act(() => {
            result.current.addTab('chatgpt')
            result.current.addTab('claude')
        })

        expect(result.current.tabs).toHaveLength(2)
        const firstTabId = result.current.tabs[0]?.id

        act(() => {
            result.current.setActiveTab(firstTabId)
        })
        expect(result.current.tabs).toHaveLength(2)

        const tabToClose = result.current.activeTabId

        // Close active tab
        act(() => {
            result.current.closeTab(tabToClose)
        })

        expect(result.current.tabs).toHaveLength(1)
        expect(result.current.activeTabId).not.toBe(tabToClose)

        const lastTab = result.current.activeTabId
        act(() => {
            result.current.closeTab(lastTab)
        })

        expect(result.current.tabs).toHaveLength(0)
        expect(result.current.activeTabId).toBe('')
    })

    it('supports pin/unpin and rename APIs', async () => {
        const { result } = renderHook(() => useAi(), { wrapper: createWrapper() })
        await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

        act(() => {
            result.current.addTab('claude')
        })

        const tabId = result.current.activeTabId

        act(() => {
            result.current.renameTab(tabId, '  Study Claude  ')
        })

        expect(result.current.tabs.find((tab) => tab.id === tabId)?.title).toBe('Study Claude')

        act(() => {
            result.current.togglePinTab(tabId)
        })

        expect(result.current.tabs.find((tab) => tab.id === tabId)?.pinned).toBe(true)

        act(() => {
            result.current.renameTab(tabId, '   ')
        })

        expect(result.current.tabs.find((tab) => tab.id === tabId)?.title).toBeUndefined()

        act(() => {
            result.current.togglePinTab(tabId)
        })

        expect(result.current.tabs.find((tab) => tab.id === tabId)?.pinned).toBe(false)
    })

    it('wraps sending text with toast notifications', async () => {
        const { result } = renderHook(() => useAi(), { wrapper: createWrapper() })
        await waitFor(() => expect(result.current.isRegistryLoaded).toBe(true))

        mockSendText.mockResolvedValue({ success: true })

        await act(async () => {
            await result.current.sendTextToAI('hello')
        })

        expect(mockSendText).toHaveBeenCalledWith('hello', undefined)
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
        // The context menu action completes
    })
})


