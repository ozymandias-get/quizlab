import type { AiContentController } from '@shared-core/types/aiContent'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockChatUiState = {
  inputValueByTab: {} as Record<string, string>,
  attachmentsByTab: {} as Record<string, string[]>,
  addAttachment: vi.fn(),
  updateInput: vi.fn()
}

const mockSendImage = vi.fn()
const mockSendText = vi.fn()
const mockScheduleApiChatSend = vi.fn()

const mockUseAiSender = vi.fn()
const mockPrepareImageForUpload = vi.fn(async (url: string) => url)

// The barrel is partially mocked, but the staged/delivery helpers are pure and
// must behave for real: the "auto-send off must not claim delivery" rule lives
// entirely in them.
vi.mock('@features/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@features/ai')>()),
  useAiSender: () => mockUseAiSender(),
  resolveAutoSend: (autoSend: boolean, options?: { autoSend?: boolean }) =>
    options?.autoSend ?? autoSend,
  useChatUiStore: { getState: () => mockChatUiState },
  prepareImageForUpload: (url: string) => mockPrepareImageForUpload(url)
}))

vi.mock('@app/providers/ai/lib/apiChatSend', () => ({
  scheduleApiChatSend: (...args: unknown[]) => mockScheduleApiChatSend(...args),
  cancelScheduledApiChatSends: vi.fn(),
  waitForApiChatTab: vi.fn(async (getActiveTabId: () => string) => getActiveTabId())
}))

vi.mock('@app/providers/ai/aiContentSendReadiness', () => ({
  waitForContentReadyForSend: vi.fn(async () => true)
}))

import { useAiMessaging } from '@app/providers/ai/useAiMessaging'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

interface ActiveTab {
  id: string
  modelId: string
}

/**
 * `activeTab` is a mutable cell so a test can simulate the user switching tabs
 * (e.g. landing on a PDF tab) between render and send.
 */
function renderMessaging(
  currentAI = 'api-chat',
  activeTab: ActiveTab = { id: 'tab-1', modelId: 'api-chat' }
) {
  const getContentController = vi.fn(() => null as AiContentController | null)
  const showSuccess = vi.fn()
  const showWarning = vi.fn()
  const openAiWorkspace = vi.fn()
  let active = activeTab
  const getActiveTab = vi.fn(() => active)

  const { result } = renderHook(() =>
    useAiMessaging({
      getContentController,
      getActiveTab,
      currentAI,
      activeTabId: active.id,
      autoSend: false,
      aiRegistry: {},
      showSuccess,
      showWarning,
      openAiWorkspace
    })
  )
  return {
    result,
    showSuccess,
    showWarning,
    openAiWorkspace,
    getContentController,
    getActiveTab
  }
}

describe('useAiMessaging — api-chat image branch', () => {
  beforeEach(() => {
    mockUseAiSender.mockReturnValue({
      sendTextToAI: mockSendText,
      sendImageToAI: mockSendImage,
      cancelOngoing: vi.fn()
    })
    mockChatUiState.inputValueByTab = {}
    mockChatUiState.attachmentsByTab = {}
    mockChatUiState.addAttachment.mockReset()
    mockChatUiState.updateInput.mockReset()
    mockSendImage.mockReset()
    mockSendText.mockReset()
    mockScheduleApiChatSend.mockReset().mockResolvedValue({ success: true })
    mockPrepareImageForUpload.mockClear()
    mockPrepareImageForUpload.mockImplementation(async (url: string) => url)
  })

  it('attaches the image to the api-chat tab', async () => {
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(mockChatUiState.addAttachment).toHaveBeenCalledWith('tab-1', PNG)
  })

  it('attaches the downscaled image when preparation changes it', async () => {
    const scaled = 'data:image/jpeg;base64,SMALLER'
    mockPrepareImageForUpload.mockResolvedValueOnce(scaled)
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(mockPrepareImageForUpload).toHaveBeenCalledWith(PNG)
    expect(mockChatUiState.addAttachment).toHaveBeenCalledWith('tab-1', scaled)
  })

  // Regression: with no note the turn would carry an image and empty text.
  // A minimal instruction keeps the attachment meaningful for providers that
  // reject an image-only content array.
  it('seeds a default prompt when no note was provided', async () => {
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(mockChatUiState.updateInput).toHaveBeenCalledWith('tab-1', 'Describe this image.')
  })

  it('uses the caller prompt instead of the default when one is given', async () => {
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG, { promptText: 'Explain the diagram' })
    })

    expect(mockChatUiState.updateInput).toHaveBeenCalledWith('tab-1', 'Explain the diagram')
  })

  it('appends the prompt to existing composer text', async () => {
    mockChatUiState.inputValueByTab['tab-1'] = 'Existing'
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG, { promptText: 'More' })
    })

    expect(mockChatUiState.updateInput).toHaveBeenCalledWith('tab-1', 'Existing\nMore')
  })

  it('does not overwrite existing composer text with the default prompt', async () => {
    mockChatUiState.inputValueByTab['tab-1'] = 'Already typing'
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(mockChatUiState.updateInput).not.toHaveBeenCalled()
  })

  it('rejects a blob: source that a provider could not resolve', async () => {
    const { result, showWarning } = renderMessaging()

    let outcome: Awaited<ReturnType<typeof result.current.sendImageToAI>> | undefined
    await act(async () => {
      outcome = await result.current.sendImageToAI('blob:http://localhost/abc')
    })

    expect(outcome).toEqual({ success: false, error: 'invalid_image_format' })
    expect(mockChatUiState.addAttachment).not.toHaveBeenCalled()
    expect(showWarning).toHaveBeenCalled()
  })

  it('rejects an http(s) source that a provider could not resolve', async () => {
    const { result } = renderMessaging()

    let outcome: Awaited<ReturnType<typeof result.current.sendImageToAI>> | undefined
    await act(async () => {
      outcome = await result.current.sendImageToAI('https://example.com/a.png')
    })

    expect(outcome).toEqual({ success: false, error: 'invalid_image_format' })
    expect(mockChatUiState.addAttachment).not.toHaveBeenCalled()
  })

  it('accepts a jpeg data URL', async () => {
    const { result } = renderMessaging()
    const jpeg = 'data:image/jpeg;base64,/9j/4AAQ'

    await act(async () => {
      await result.current.sendImageToAI(jpeg)
    })

    expect(mockChatUiState.addAttachment).toHaveBeenCalledWith('tab-1', jpeg)
  })

  it('does not schedule a send when auto-send is off', async () => {
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(mockScheduleApiChatSend).not.toHaveBeenCalled()
  })

  it('schedules a send when auto-send is on', async () => {
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG, { autoSend: true })
    })

    expect(mockScheduleApiChatSend).toHaveBeenCalled()
  })

  it('does not touch the composer for content targets', async () => {
    mockSendImage.mockResolvedValue({ success: true, mode: 'auto_click' })
    const { result } = renderMessaging('chatgpt')

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(mockChatUiState.addAttachment).not.toHaveBeenCalled()
    expect(mockSendImage).toHaveBeenCalledWith(PNG, undefined)
  })
})

// Regression: the composer showed "Sent successfully!" for outcomes that never
// reached a model. Both paths below looked identical to the user, so a queued
// image simply disappeared.
describe('useAiMessaging — delivery reporting', () => {
  beforeEach(() => {
    mockUseAiSender.mockReturnValue({
      sendTextToAI: mockSendText,
      sendImageToAI: mockSendImage,
      cancelOngoing: vi.fn()
    })
    mockChatUiState.inputValueByTab = {}
    mockChatUiState.attachmentsByTab = {}
    mockChatUiState.addAttachment.mockReset()
    mockChatUiState.updateInput.mockReset()
    mockSendImage.mockReset()
    mockSendText.mockReset()
    mockScheduleApiChatSend.mockReset().mockResolvedValue({ success: true })
    mockPrepareImageForUpload.mockClear()
    mockPrepareImageForUpload.mockImplementation(async (url: string) => url)
  })

  it('reports staging instead of delivery when auto-send is off', async () => {
    const { result, showSuccess, showWarning } = renderMessaging()

    let outcome: Awaited<ReturnType<typeof result.current.sendImageToAI>> | undefined
    await act(async () => {
      outcome = await result.current.sendImageToAI(PNG)
    })

    expect(outcome).toEqual({ success: true, mode: 'staged' })
    // Never "Sent successfully!" — nothing was delivered.
    expect(showSuccess).not.toHaveBeenCalledWith('sent_successfully')
    expect(showSuccess).toHaveBeenCalledWith('Added to the chat box. Press Send to deliver.')
    expect(showWarning).not.toHaveBeenCalled()
  })

  it('claims delivery when an auto-sent api-chat request succeeds', async () => {
    const { result, showSuccess } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG, { autoSend: true })
    })

    expect(showSuccess).toHaveBeenCalledWith('sent_successfully')
  })

  it.each(['auto_click', 'auto_click_with_prompt'])(
    'claims delivery for the content mode %s',
    async (mode) => {
      mockSendImage.mockResolvedValue({ success: true, mode })
      const { result, showSuccess } = renderMessaging('chatgpt')

      await act(async () => {
        await result.current.sendImageToAI(PNG, { autoSend: true })
      })

      expect(showSuccess).toHaveBeenCalledWith('sent_successfully')
    }
  )

  // The image only landed in the site's input box; submitting is still pending.
  it.each(['paste_only', 'paste_and_prompt'])(
    'reports staging rather than delivery for the content mode %s',
    async (mode) => {
      mockSendImage.mockResolvedValue({ success: true, mode })
      const { result, showSuccess, showWarning } = renderMessaging('chatgpt')

      await act(async () => {
        await result.current.sendImageToAI(PNG)
      })

      expect(showSuccess).not.toHaveBeenCalledWith('sent_successfully')
      // The user needs to know the image is sitting in the composer awaiting
      // their submit, which is the whole point of auto-send being off.
      expect(showSuccess).toHaveBeenCalledWith('Added to the chat box. Press Send to deliver.')
      expect(showWarning).not.toHaveBeenCalled()
    }
  )

  it('does not claim delivery when the content send failed', async () => {
    mockSendImage.mockResolvedValue({ success: false, error: 'paste_failed' })
    const { result, showSuccess, showWarning } = renderMessaging('chatgpt')

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(showSuccess).not.toHaveBeenCalled()
    expect(showWarning).toHaveBeenCalled()
  })

  it('treats a result without a mode as delivered', async () => {
    mockSendImage.mockResolvedValue({ success: true })
    const { result, showSuccess } = renderMessaging('chatgpt')

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(showSuccess).toHaveBeenCalledWith('sent_successfully')
  })
})

// Regression: the active tab is not necessarily an api-chat tab. Attaching to
// a PDF tab id wrote the image into per-tab state that no composer reads, and
// the send still reported success.
describe('useAiMessaging — api-chat tab targeting', () => {
  beforeEach(() => {
    mockUseAiSender.mockReturnValue({
      sendTextToAI: mockSendText,
      sendImageToAI: mockSendImage,
      cancelOngoing: vi.fn()
    })
    mockChatUiState.inputValueByTab = {}
    mockChatUiState.attachmentsByTab = {}
    mockChatUiState.addAttachment.mockReset()
    mockChatUiState.updateInput.mockReset()
    mockSendImage.mockReset()
    mockSendText.mockReset()
    mockScheduleApiChatSend.mockReset().mockResolvedValue({ success: true })
    mockPrepareImageForUpload.mockClear()
    mockPrepareImageForUpload.mockImplementation(async (url: string) => url)
  })

  it('attaches to the active api-chat tab without opening another', async () => {
    const { result, openAiWorkspace } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(openAiWorkspace).not.toHaveBeenCalled()
    expect(mockChatUiState.addAttachment).toHaveBeenCalledWith('tab-1', PNG)
  })

  it('opens an api-chat tab when the active tab is a PDF', async () => {
    const { result, openAiWorkspace } = renderMessaging('api-chat', {
      id: 'pdf-tab',
      modelId: 'pdf'
    })

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(openAiWorkspace).toHaveBeenCalledWith('api-chat')
    expect(mockChatUiState.addAttachment).not.toHaveBeenCalledWith('pdf-tab', PNG)
  })

  it('opens an api-chat tab when the active tab is a content tab', async () => {
    const { result, openAiWorkspace } = renderMessaging('api-chat', {
      id: 'gpt-tab',
      modelId: 'chatgpt'
    })

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(openAiWorkspace).toHaveBeenCalledWith('api-chat')
    expect(mockChatUiState.addAttachment).not.toHaveBeenCalledWith('gpt-tab', PNG)
  })

  it('gives up rather than attaching to a non-api-chat tab', async () => {
    const { result } = renderMessaging('api-chat', { id: 'pdf-tab', modelId: 'pdf' })

    let outcome: Awaited<ReturnType<typeof result.current.sendImageToAI>> | undefined
    await act(async () => {
      outcome = await result.current.sendImageToAI(PNG)
    })

    expect(outcome).toEqual({ success: false, error: 'webview_not_ready' })
    expect(mockChatUiState.addAttachment).not.toHaveBeenCalled()
  })
})
