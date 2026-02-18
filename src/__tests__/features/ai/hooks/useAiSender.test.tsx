import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAiSender } from '../../../../features/ai/hooks/useAiSender'

// Mocks using vi.hoisted
const { mockLogger, mockUsePrompts, mockSafeWebviewPaste } = vi.hoisted(() => ({
    mockLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    },
    mockUsePrompts: vi.fn(() => ({ activePromptText: '' })),
    mockSafeWebviewPaste: vi.fn(() => true)
}))

vi.mock('@src/utils/logger', () => ({
    Logger: mockLogger
}))

vi.mock('@features/ai/hooks/usePrompts', () => ({
    usePrompts: mockUsePrompts
}))

vi.mock('@src/utils/webviewUtils', () => ({
    safeWebviewPaste: mockSafeWebviewPaste
}))

vi.mock('@src/app/providers/ToastContext', () => ({
    useToast: () => ({
        showError: vi.fn(),
        showSuccess: vi.fn(),
        showInfo: vi.fn(),
        showWarning: vi.fn()
    })
}))

vi.mock('@src/app/providers/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
        language: 'en'
    })
}))

// Wrapper for QueryClientProvider
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
            mutations: {
                retry: false,
            },
        },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient} > {children} </QueryClientProvider>
    )
}

describe('useAiSender', () => {
    // Setup Electron API mock
    const mockGenerateAutoSendScript = vi.fn()
    const mockGenerateClickSendScript = vi.fn()
    const mockGenerateFocusScript = vi.fn()
    const mockCopyImageToClipboard = vi.fn()
    const mockGetAiConfig = vi.fn()

    const originalElectronAPI = window.electronAPI

    const mockWebview = {
        getURL: vi.fn(),
        executeJavaScript: vi.fn(),
        isDestroyed: vi.fn(() => false),
        focus: vi.fn(),
        getWebContentsId: vi.fn(() => 1),
        pasteNative: vi.fn(() => true)
    }

    const mockWebviewRef = { current: mockWebview } as any

    const mockAiRegistry = {
        'gpt-4': {
            input: '#input',
            button: '#send',
            submitMode: 'click',
            domainRegex: 'openai\\.com'
        }
    }

    beforeEach(() => {
        vi.clearAllMocks()

        window.electronAPI = {
            automation: {
                generateAutoSendScript: mockGenerateAutoSendScript,
                generateClickSendScript: mockGenerateClickSendScript,
                generateFocusScript: mockGenerateFocusScript
            },
            copyImageToClipboard: mockCopyImageToClipboard,
            getAiConfig: mockGetAiConfig
        } as any

        // Defaults
        mockWebview.getURL.mockReturnValue('https://openai.com/chat')
        mockWebview.executeJavaScript.mockResolvedValue({ success: true, mode: 'click' })
        mockGenerateAutoSendScript.mockResolvedValue('document.querySelector("#input").value = "text";')
        mockGenerateFocusScript.mockResolvedValue('focus()')
        mockGetAiConfig.mockResolvedValue({})
    })

    afterEach(() => {
        window.electronAPI = originalElectronAPI
    })

    it('sends text successfully', async () => {
        const { result } = renderHook(() => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any), {
            wrapper: createWrapper()
        })

        let res: any
        await act(async () => {
            res = await result.current.sendTextToAI('hello')
        })

        if (!res.success) {
            console.error('sendTextToAI failed with:', res.error)
        }
        expect(res).toEqual(expect.objectContaining({ success: true }))
        expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
            expect.objectContaining({ input: '#input' }),
            'hello',
            false
        )
        expect(mockWebview.executeJavaScript).toHaveBeenCalled()
    })

    it('injects active prompt if present', async () => {
        mockUsePrompts.mockReturnValue({ activePromptText: 'Act as a expert' })
        const { result } = renderHook(() => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any), {
            wrapper: createWrapper()
        })

        await act(async () => {
            await result.current.sendTextToAI('hello')
        })

        expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
            expect.anything(),
            'Act as a expert\n\nhello',
            false
        )
    })

    it('handles cached config with regex validation', async () => {
        mockWebview.getURL.mockReturnValue('https://other.com')
        // Regex for gpt-4 is openai.com, so this should fail regex check if enforced?
        // Code: if (regex) { if (!regex.test(currentUrl)) return error }

        const { result } = renderHook(() => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any), {
            wrapper: createWrapper()
        })

        let res: any
        await act(async () => {
            res = await result.current.sendTextToAI('hello')
        })
        expect(res.success).toBe(false)
        expect(res.error).toBe('wrong_url')
    })

    it('fetches custom config from API', async () => {
        mockWebview.getURL.mockReturnValue('https://openai.com')
        mockGetAiConfig.mockResolvedValue({ input: '.custom-input', button: '.custom-btn' })

        const { result } = renderHook(() => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any), {
            wrapper: createWrapper()
        })

        await act(async () => {
            await result.current.sendTextToAI('hello')
        })

        // Should trigger getAiConfig
        expect(mockGetAiConfig).toHaveBeenCalledWith('openai.com')

        // And use new selectors
        const calls = mockGenerateAutoSendScript.mock.calls
        expect(calls.length).toBeGreaterThan(0)
        // Check the second argument (options) or first depending on structure
        // useGenerateAutoSendScript calls api.generateAutoSendScript(config, text, submit)
        // Wait, the hook calls mutate({ config, text, submit }).
        // The mockGenerateAutoSendScript is the WINDOW API mock.
        // It receives (config, text, submit)

        const configArg = calls[0][0]
        expect(configArg.input).toBe('.custom-input')
        expect(configArg.button).toBe('.custom-btn')
    })

    it('sends image successfully (paste + prompt)', async () => {
        const imageDataUrl = 'data:image/png;base64,xxxx'
        mockCopyImageToClipboard.mockResolvedValue(true)
        mockGenerateFocusScript.mockResolvedValue('focus()')
        mockGenerateAutoSendScript.mockResolvedValue('send()')
        mockUsePrompts.mockReturnValue({ activePromptText: 'Describe this' })

        const { result } = renderHook(() => useAiSender(mockWebviewRef, 'gpt-4', true, mockAiRegistry as any), {
            wrapper: createWrapper()
        })

        let res: any
        await act(async () => {
            res = await result.current.sendImageToAI(imageDataUrl)
        })

        expect(res.success).toBe(true)
        expect(mockCopyImageToClipboard).toHaveBeenCalledWith(imageDataUrl)
        expect(mockWebview.pasteNative).toHaveBeenCalled() // Electron 22+ path

        // Prompt injection
        expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
            expect.anything(),
            'Describe this',
            true
        )
    })

    it('handles clipboard failure', async () => {
        mockCopyImageToClipboard.mockResolvedValue(false)
        const { result } = renderHook(() => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any), {
            wrapper: createWrapper()
        })

        let res: any
        await act(async () => {
            res = await result.current.sendImageToAI('data:image/png;base64,xx')
        })
        expect(res.success).toBe(false)
        expect(res.error).toBe('clipboard_failed')
    })
})


