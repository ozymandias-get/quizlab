/**
 * Shared test setup for useAiSender tests.
 *
 * Extracts the duplicate beforeEach/afterEach logic from:
 *   - text-sending.test.tsx
 *   - image-sending.test.tsx
 *   - error-handling.test.tsx
 */
import {
  mockCopyImageToClipboard,
  mockGenerateAutoSendScript,
  mockGenerateClickSendScript,
  mockGenerateFocusScript,
  mockGenerateWaitForSubmitReadyScript,
  mockGetAiConfig,
  mockScriptDiagnostics,
  mockWebview
} from './mocks'
import { mockState } from './mockState'

export function setupUseAiSenderMocks(): void {
  mockState.mockUsePrompts.mockReturnValue({ activePromptText: '' })

  window.electronAPI = {
    automation: {
      generateAutoSendScript: mockGenerateAutoSendScript,
      generateClickSendScript: mockGenerateClickSendScript,
      generateFocusScript: mockGenerateFocusScript,
      generateWaitForSubmitReadyScript: mockGenerateWaitForSubmitReadyScript
    },
    copyImageToClipboard: mockCopyImageToClipboard,
    getAiConfig: mockGetAiConfig
  } as unknown as Window['electronAPI']

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
}
