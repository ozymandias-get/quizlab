import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAiSender } from '@features/ai/hooks/useAiSender'

const { mockLogger, mockUsePrompts, mockSafeWebviewPaste } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  },
  mockUsePrompts: vi.fn((): { activePromptText: string | null } => ({ activePromptText: '' })),
  mockSafeWebviewPaste: vi.fn(() => true)
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: mockLogger
}))

vi.mock('@features/ai/hooks/usePrompts', () => ({
  usePrompts: mockUsePrompts
}))

vi.mock('@shared/lib/webviewUtils', () => ({
  safeWebviewPaste: mockSafeWebviewPaste
}))

vi.mock('@app/providers/ToastContext', () => ({
  useToast: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn()
  })
}))

vi.mock('@app/providers/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en'
  })
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      },
      mutations: {
        retry: false
      }
    }
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useAiSender', () => {
  const mockGenerateAutoSendScript = vi.fn()
  const mockGenerateClickSendScript = vi.fn()
  const mockGenerateFocusScript = vi.fn()
  const mockGenerateWaitForSubmitReadyScript = vi.fn()
  const mockCopyImageToClipboard = vi.fn()
  const mockGetAiConfig = vi.fn()

  const originalElectronAPI = window.electronAPI
  const mockScriptDiagnostics = {
    kind: 'auto_send',
    pageUrl: 'https://openai.com/chat',
    totalMs: 12,
    input: {
      requestedSelector: '#input',
      matchedSelector: '#input',
      strategy: 'direct',
      durationMs: 2,
      waitIterations: 1,
      cacheHits: 0,
      cacheInvalidations: 0,
      interactiveRequired: false
    },
    button: {
      requestedSelector: '#send',
      matchedSelector: '#send',
      strategy: 'direct',
      durationMs: 1,
      waitIterations: 1,
      cacheHits: 0,
      cacheInvalidations: 0,
      interactiveRequired: true
    },
    setInputMs: 4,
    submitMs: 5,
    error: null
  } as const

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
    mockUsePrompts.mockReturnValue({ activePromptText: '' })

    window.electronAPI = {
      automation: {
        generateAutoSendScript: mockGenerateAutoSendScript,
        generateClickSendScript: mockGenerateClickSendScript,
        generateFocusScript: mockGenerateFocusScript,
        generateWaitForSubmitReadyScript: mockGenerateWaitForSubmitReadyScript
      },
      copyImageToClipboard: mockCopyImageToClipboard,
      getAiConfig: mockGetAiConfig
    } as any

    mockWebview.getURL.mockReturnValue('https://openai.com/chat')
    mockWebview.executeJavaScript.mockResolvedValue({
      success: true,
      mode: 'click',
      diagnostics: mockScriptDiagnostics
    })
    mockGenerateAutoSendScript.mockResolvedValue('document.querySelector("#input").value = "text";')
    mockGenerateFocusScript.mockResolvedValue('focus()')
    mockGenerateClickSendScript.mockResolvedValue('click()')
    mockGenerateWaitForSubmitReadyScript.mockResolvedValue('waitReady()')
    mockGetAiConfig.mockResolvedValue({})
  })

  afterEach(() => {
    window.electronAPI = originalElectronAPI
  })

  it('sends text successfully with diagnostics', async () => {
    const { result } = renderHook(
      () => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any, 'tab-1'),
      {
        wrapper: createWrapper()
      }
    )

    let res: any
    await act(async () => {
      res = await result.current.sendTextToAI('hello')
    })

    expect(res).toEqual(expect.objectContaining({ success: true }))
    expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
      expect.objectContaining({ input: '#input' }),
      'hello',
      false,
      false
    )
    expect(mockWebview.executeJavaScript).toHaveBeenCalled()
    expect(res.diagnostics?.tabId).toBe('tab-1')
    expect(res.diagnostics?.currentAI).toBe('gpt-4')
    expect(res.diagnostics?.currentUrl).toBe('https://openai.com/chat')
    expect(res.diagnostics?.script?.kind).toBe('auto_send')
  })

  it('injects active prompt if present', async () => {
    mockUsePrompts.mockReturnValue({ activePromptText: 'Act as a expert' })
    const { result } = renderHook(
      () => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any, 'tab-1'),
      {
        wrapper: createWrapper()
      }
    )

    await act(async () => {
      await result.current.sendTextToAI('hello')
    })

    expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
      expect.anything(),
      'Act as a expert\n\nhello',
      false,
      false
    )
  })

  it('merges local prompt text with active prompt', async () => {
    mockUsePrompts.mockReturnValue({ activePromptText: 'Act as a expert' })
    const { result } = renderHook(
      () => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any, 'tab-1'),
      {
        wrapper: createWrapper()
      }
    )

    await act(async () => {
      await result.current.sendTextToAI('hello', {
        promptText: 'Focus on key terms',
        autoSend: true
      })
    })

    expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
      expect.anything(),
      'Act as a expert\n\nFocus on key terms\n\nhello',
      true,
      false
    )
  })

  it('handles cached config with regex validation', async () => {
    mockWebview.getURL.mockReturnValue('https://other.com')

    const { result } = renderHook(
      () => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any, 'tab-1'),
      {
        wrapper: createWrapper()
      }
    )

    let res: any
    await act(async () => {
      res = await result.current.sendTextToAI('hello')
    })

    expect(res.success).toBe(false)
    expect(res.error).toBe('wrong_url')
    expect(res.diagnostics?.currentUrl).toBe('https://other.com')
  })

  it('fetches custom config from API', async () => {
    mockWebview.getURL.mockReturnValue('https://openai.com')
    mockGetAiConfig.mockResolvedValue({ input: '.custom-input', button: '.custom-btn' })

    const { result } = renderHook(
      () => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any, 'tab-1'),
      {
        wrapper: createWrapper()
      }
    )

    await act(async () => {
      await result.current.sendTextToAI('hello')
    })

    expect(mockGetAiConfig).toHaveBeenCalledWith('openai.com')
    const calls = mockGenerateAutoSendScript.mock.calls
    expect(calls.length).toBeGreaterThan(0)

    const configArg = calls[0][0]
    expect(configArg.input).toBe('.custom-input')
    expect(configArg.button).toBe('.custom-btn')
  })

  it('sends image successfully and captures script diagnostics', async () => {
    const imageDataUrl = 'data:image/png;base64,xxxx'
    mockCopyImageToClipboard.mockResolvedValue(true)
    mockGenerateFocusScript.mockResolvedValue('focus()')
    mockGenerateAutoSendScript.mockResolvedValue('send()')
    mockGenerateWaitForSubmitReadyScript.mockResolvedValue('waitReady()')
    mockGenerateClickSendScript.mockResolvedValue('click()')
    mockUsePrompts.mockReturnValue({ activePromptText: 'Describe this' })
    mockWebview.executeJavaScript
      .mockResolvedValueOnce({
        success: true,
        diagnostics: { ...mockScriptDiagnostics, kind: 'focus', button: undefined, submitMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        diagnostics: { ...mockScriptDiagnostics, kind: 'focus', button: undefined, submitMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        action: 'input_only',
        diagnostics: { ...mockScriptDiagnostics, kind: 'auto_send', submitMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        action: 'submit_ready',
        diagnostics: { ...mockScriptDiagnostics, kind: 'submit_ready', setInputMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        mode: 'click',
        diagnostics: { ...mockScriptDiagnostics, kind: 'click_send', setInputMs: 0 }
      })

    const { result } = renderHook(
      () => useAiSender(mockWebviewRef, 'gpt-4', true, mockAiRegistry as any, 'tab-1'),
      {
        wrapper: createWrapper()
      }
    )

    let res: any
    await act(async () => {
      res = await result.current.sendImageToAI(imageDataUrl)
    })

    expect(res.success).toBe(true)
    expect(mockCopyImageToClipboard).toHaveBeenCalledWith(imageDataUrl)
    expect(mockWebview.pasteNative).toHaveBeenCalled()
    expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
      expect.anything(),
      'Describe this',
      false,
      true
    )
    expect(mockGenerateWaitForSubmitReadyScript).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        minimumWaitMs: 1000,
        settleMs: 1200
      })
    )
    expect(mockGenerateClickSendScript).toHaveBeenCalledWith(expect.anything())
    expect(res.diagnostics?.focusScript?.kind).toBe('focus')
    expect(res.diagnostics?.refocusScript?.kind).toBe('focus')
    expect(res.diagnostics?.promptScript?.kind).toBe('auto_send')
    expect(res.diagnostics?.submitReadyScript?.kind).toBe('submit_ready')
    expect(res.diagnostics?.clickScript?.kind).toBe('click_send')
  })

  it('forceAutoSend runs click after note prompt when global auto-send is off', async () => {
    const imageDataUrl = 'data:image/png;base64,xxxx'
    mockCopyImageToClipboard.mockResolvedValue(true)
    mockGenerateFocusScript.mockResolvedValue('focus()')
    mockGenerateAutoSendScript.mockResolvedValue('send()')
    mockGenerateWaitForSubmitReadyScript.mockResolvedValue('waitReady()')
    mockGenerateClickSendScript.mockResolvedValue('click()')
    mockUsePrompts.mockReturnValue({ activePromptText: null })
    mockWebview.executeJavaScript
      .mockResolvedValueOnce({
        success: true,
        diagnostics: { ...mockScriptDiagnostics, kind: 'focus', button: undefined, submitMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        diagnostics: { ...mockScriptDiagnostics, kind: 'focus', button: undefined, submitMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        action: 'input_only',
        diagnostics: { ...mockScriptDiagnostics, kind: 'auto_send', submitMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        action: 'submit_ready',
        diagnostics: { ...mockScriptDiagnostics, kind: 'submit_ready', setInputMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        mode: 'click',
        diagnostics: { ...mockScriptDiagnostics, kind: 'click_send', setInputMs: 0 }
      })

    const { result } = renderHook(
      () => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any, 'tab-1'),
      {
        wrapper: createWrapper()
      }
    )

    let res: any
    await act(async () => {
      res = await result.current.sendImageToAI(imageDataUrl, {
        promptText: 'Ek not',
        forceAutoSend: true
      })
    })

    expect(res.success).toBe(true)
    expect(mockGenerateClickSendScript).toHaveBeenCalled()
    expect(res.mode).toBe('auto_click_with_prompt')
  })

  it('uses local image prompt without a global prompt', async () => {
    const imageDataUrl = 'data:image/png;base64,xxxx'
    mockCopyImageToClipboard.mockResolvedValue(true)
    mockGenerateFocusScript.mockResolvedValue('focus()')
    mockGenerateAutoSendScript.mockResolvedValue('send()')
    mockWebview.executeJavaScript
      .mockResolvedValueOnce({
        success: true,
        diagnostics: { ...mockScriptDiagnostics, kind: 'focus', button: undefined, submitMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        diagnostics: mockScriptDiagnostics
      })

    const { result } = renderHook(
      () => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any, 'tab-1'),
      {
        wrapper: createWrapper()
      }
    )

    await act(async () => {
      await result.current.sendImageToAI(imageDataUrl, {
        promptText: 'Bu grafiği açıkla',
        autoSend: false
      })
    })

    expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
      expect.anything(),
      'Bu grafiği açıkla',
      false,
      true
    )
  })

  it('disables append prompt mode when appendPromptAfterPaste is false', async () => {
    const imageDataUrl = 'data:image/png;base64,xxxx'
    mockCopyImageToClipboard.mockResolvedValue(true)
    mockGenerateFocusScript.mockResolvedValue('focus()')
    mockGenerateAutoSendScript.mockResolvedValue('send()')
    mockWebview.executeJavaScript
      .mockResolvedValueOnce({
        success: true,
        diagnostics: { ...mockScriptDiagnostics, kind: 'focus', button: undefined, submitMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        diagnostics: { ...mockScriptDiagnostics, kind: 'focus', button: undefined, submitMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        action: 'input_only',
        diagnostics: { ...mockScriptDiagnostics, kind: 'auto_send', submitMs: 0 }
      })

    const { result } = renderHook(
      () => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any, 'tab-1'),
      {
        wrapper: createWrapper()
      }
    )

    await act(async () => {
      await result.current.sendImageToAI(imageDataUrl, {
        promptText: 'note',
        autoSend: false,
        appendPromptAfterPaste: false
      })
    })

    expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(expect.anything(), 'note', false, false)
  })

  it('handles clipboard failure', async () => {
    mockCopyImageToClipboard.mockResolvedValue(false)
    const { result } = renderHook(
      () => useAiSender(mockWebviewRef, 'gpt-4', false, mockAiRegistry as any, 'tab-1'),
      {
        wrapper: createWrapper()
      }
    )

    let res: any
    await act(async () => {
      res = await result.current.sendImageToAI('data:image/png;base64,xx')
    })

    expect(res.success).toBe(false)
    expect(res.error).toBe('clipboard_failed')
    expect(res.diagnostics?.timings.clipboardMs).toBeDefined()
  })

  it('returns diagnostics when no webview is available', async () => {
    const emptyRef = { current: null as any }
    const { result } = renderHook(
      () => useAiSender(emptyRef, 'gpt-4', false, mockAiRegistry as any, 'tab-stale'),
      {
        wrapper: createWrapper()
      }
    )

    let res: any
    await act(async () => {
      res = await result.current.sendTextToAI('hello')
    })

    expect(res.success).toBe(false)
    expect(res.error).toBe('invalid_input')
    expect(res.diagnostics?.tabId).toBe('tab-stale')
  })
})
