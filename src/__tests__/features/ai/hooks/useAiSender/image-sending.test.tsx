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

describe('useAiSender - image sending', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupUseAiSenderMocks()
  })

  afterEach(() => {
    window.electronAPI = originalElectronAPI
  })

  it('sends image successfully and captures script diagnostics', async () => {
    const imageDataUrl = 'data:image/png;base64,xxxx'
    mockCopyImageToClipboard.mockResolvedValue(true)
    mockGenerateFocusScript.mockResolvedValue('focus()')
    mockGenerateAutoSendScript.mockResolvedValue('send()')
    mockGenerateWaitForSubmitReadyScript.mockResolvedValue('waitReady()')
    mockGenerateClickSendScript.mockResolvedValue('click()')
    mockState.mockUsePrompts.mockReturnValue({ activePromptText: 'Describe this' })
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
      () =>
        useAiSender(
          mockWebviewRef,
          'gpt-4',
          true,
          mockAiRegistry as unknown as Parameters<typeof useAiSender>[3],
          'tab-1'
        ),
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
      true,
      'auto',
      30
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
    mockState.mockUsePrompts.mockReturnValue({ activePromptText: null })
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
      true,
      'auto',
      30
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
        diagnostics: { ...mockScriptDiagnostics, kind: 'focus', button: undefined, submitMs: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        action: 'input_only',
        diagnostics: { ...mockScriptDiagnostics, kind: 'auto_send', submitMs: 0 }
      })

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

    await act(async () => {
      await result.current.sendImageToAI(imageDataUrl, {
        promptText: 'note',
        autoSend: false,
        appendPromptAfterPaste: false
      })
    })

    expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
      expect.anything(),
      'note',
      false,
      false,
      'auto',
      30
    )
  })
})
