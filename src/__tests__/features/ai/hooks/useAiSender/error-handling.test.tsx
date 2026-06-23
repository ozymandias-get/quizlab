import { vi } from 'vitest'

import { mockState } from './mockState'

vi.mock('@shared/lib/logger', () => ({
  Logger: mockState.mockLogger
}))

vi.mock('@features/ai/hooks/usePrompts', () => ({
  usePrompts: mockState.mockUsePrompts
}))

vi.mock('@features/ai/hooks/useTextInputMode', () => ({
  useTextInputMode: mockState.mockUseTextInputMode
}))

import { useAiSender } from '@features/ai/hooks/useAiSender'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createWrapper,
  mockAiRegistry,
  mockCopyImageToClipboard,
  mockGenerateAutoSendScript,
  mockGenerateClickSendScript,
  mockGenerateFocusScript,
  mockGenerateWaitForSubmitReadyScript,
  mockScriptDiagnostics,
  mockWebview,
  mockWebviewRef
} from './mocks'
import { setupUseAiSenderMocks } from './sharedTestSetup'

const originalElectronAPI = window.electronAPI

describe('useAiSender - error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupUseAiSenderMocks()
  })

  afterEach(() => {
    window.electronAPI = originalElectronAPI
  })

  it('handles clipboard failure', async () => {
    mockCopyImageToClipboard.mockResolvedValue(false)
    const { result } = renderHook(
      () =>
        useAiSender(
          mockWebviewRef,
          'gpt-4',
          false,
          mockAiRegistry as unknown as Parameters<typeof useAiSender>[3],
          'tab-1'
        ),
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

  it('returns autosend_failed_draft_saved when click step fails in image autosend', async () => {
    const imageDataUrl = 'data:image/png;base64,xxxx'
    mockCopyImageToClipboard.mockResolvedValue(true)
    mockGenerateFocusScript.mockResolvedValue('focus()')
    mockGenerateAutoSendScript.mockResolvedValue('send()')
    mockGenerateWaitForSubmitReadyScript.mockResolvedValue('waitReady()')
    mockGenerateClickSendScript.mockResolvedValue('click()')
    mockState.mockUsePrompts.mockReturnValue({ activePromptText: 'Describe this' })
    mockWebview.executeJavaScript
      .mockResolvedValueOnce({ success: true, diagnostics: mockScriptDiagnostics })
      .mockResolvedValueOnce({ success: true, diagnostics: mockScriptDiagnostics })
      .mockResolvedValueOnce({ success: true, diagnostics: mockScriptDiagnostics })
      .mockResolvedValueOnce({ success: false, error: 'autosend_failed_draft_saved' })

    const { result } = renderHook(
      () =>
        useAiSender(
          mockWebviewRef,
          'gpt-4',
          true,
          mockAiRegistry as unknown as Parameters<typeof useAiSender>[3],
          'tab-1'
        ),
      { wrapper: createWrapper() }
    )

    let res: any
    await act(async () => {
      res = await result.current.sendImageToAI(imageDataUrl)
    })

    expect(res.success).toBe(false)
    expect(res.error).toBe('autosend_failed_draft_saved')
  })

  it('returns webview_destroyed when scheduled webview changes before execution', async () => {
    const swappedRef = {
      current: mockWebview
    } as unknown as Parameters<typeof useAiSender>[0]

    const { result } = renderHook(
      () =>
        useAiSender(
          swappedRef,
          'gpt-4',
          false,
          mockAiRegistry as unknown as Parameters<typeof useAiSender>[3],
          'tab-1'
        ),
      { wrapper: createWrapper() }
    )

    const anotherWebview = { ...mockWebview, executeJavaScript: vi.fn() }
    mockGenerateAutoSendScript.mockImplementationOnce(async () => {
      swappedRef.current = anotherWebview as any
      return 'send()'
    })

    let res: any
    await act(async () => {
      res = await result.current.sendTextToAI('hello')
    })

    expect(res.success).toBe(false)
    expect(res.error).toBe('webview_destroyed')
  })

  it('returns diagnostics when no webview is available', async () => {
    const emptyRef = { current: null } as unknown as Parameters<typeof useAiSender>[0]
    const { result } = renderHook(
      () =>
        useAiSender(
          emptyRef,
          'gpt-4',
          false,
          mockAiRegistry as unknown as Parameters<typeof useAiSender>[3],
          'tab-stale'
        ),
      {
        wrapper: createWrapper()
      }
    )

    let res: any
    await act(async () => {
      res = await result.current.sendTextToAI('hello')
    })

    expect(res.success).toBe(false)
    expect(res.error).toBe('webview_not_ready')
    expect(res.diagnostics?.tabId).toBe('tab-stale')
  })
})
