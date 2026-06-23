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
  mockGenerateAutoSendScript,
  mockGetAiConfig,
  mockWebview,
  mockWebviewRef
} from './mocks'
import { setupUseAiSenderMocks } from './sharedTestSetup'

const originalElectronAPI = window.electronAPI

describe('useAiSender - text sending', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupUseAiSenderMocks()
  })

  afterEach(() => {
    window.electronAPI = originalElectronAPI
  })

  it('sends text successfully with diagnostics', async () => {
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
      res = await result.current.sendTextToAI('hello')
    })

    expect(res).toEqual(expect.objectContaining({ success: true }))
    expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
      expect.objectContaining({ input: '#input' }),
      'hello',
      false,
      true,
      'auto',
      30
    )
    expect(mockWebview.executeJavaScript).toHaveBeenCalled()
    expect(res.diagnostics?.tabId).toBe('tab-1')
    expect(res.diagnostics?.currentAI).toBe('gpt-4')
    expect(res.diagnostics?.currentUrl).toBe('https://openai.com/chat')
    expect(res.diagnostics?.script?.kind).toBe('auto_send')
  })

  it('injects active prompt if present', async () => {
    mockState.mockUsePrompts.mockReturnValue({ activePromptText: 'Act as a expert' })
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
      await result.current.sendTextToAI('hello')
    })

    expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
      expect.anything(),
      'Act as a expert\n\nhello',
      false,
      true,
      'auto',
      30
    )
  })

  it('merges local prompt text with active prompt', async () => {
    mockState.mockUsePrompts.mockReturnValue({ activePromptText: 'Act as a expert' })
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
      await result.current.sendTextToAI('hello', {
        promptText: 'Focus on key terms',
        autoSend: true
      })
    })

    expect(mockGenerateAutoSendScript).toHaveBeenCalledWith(
      expect.anything(),
      'Act as a expert\n\nFocus on key terms\n\nhello',
      true,
      true,
      'auto',
      30
    )
  })

  it('handles cached config with regex validation', async () => {
    mockWebview.getURL.mockReturnValue('https://other.com')

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
      await result.current.sendTextToAI('hello')
    })

    expect(mockGetAiConfig).toHaveBeenCalledWith('openai.com')
    const calls = mockGenerateAutoSendScript.mock.calls
    expect(calls.length).toBeGreaterThan(0)

    const configArg = calls[0][0]
    expect(configArg.input).toBe('.custom-input')
    expect(configArg.button).toBe('.custom-btn')
  })
})
