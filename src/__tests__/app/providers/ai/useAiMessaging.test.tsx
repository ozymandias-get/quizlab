import type { AiContentController } from '@shared-core/types/aiContent'

import { resolveSendOutcome } from '@app/ui/aiSendComposer/sendOutcome'

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
import { NO_SEND_RESULT } from '@app/providers/ai/types'

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
      showWarning,
      openAiWorkspace
    })
  )
  return {
    result,
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
  // reject an image-only content array. The copy is count-aware (singular for
  // one image, plural for a bulk send) and no longer repeats the same verb.
  it('seeds a default prompt when no note was provided', async () => {
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(mockChatUiState.updateInput).toHaveBeenCalledWith(
      'tab-1',
      'Describe and summarise this image.'
    )
  })

  it('seeds the plural prompt for a multi-image turn', async () => {
    mockUseAiSender.mockReturnValue({
      sendTextToAI: mockSendText,
      sendImageToAI: mockSendImage,
      sendBulkToAI: vi.fn().mockResolvedValue({ success: true }),
      cancelOngoing: vi.fn()
    })
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendBulkToAI?.([PNG, PNG])
    })

    expect(mockChatUiState.updateInput).toHaveBeenCalledWith(
      'tab-1',
      'Describe and summarise these images.'
    )
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

  it('stages silently when auto-send is off', async () => {
    const { result, showWarning } = renderMessaging()

    let outcome: Awaited<ReturnType<typeof result.current.sendImageToAI>> | undefined
    await act(async () => {
      outcome = await result.current.sendImageToAI(PNG)
    })

    expect(outcome).toMatchObject({ success: true, mode: 'staged' })
    expect(showWarning).not.toHaveBeenCalled()
  })

  it('stays silent when an auto-sent api-chat request succeeds', async () => {
    const { result, showWarning } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG, { autoSend: true })
    })

    // No success toast: `showSuccess` is no longer even wired into this hook, so
    // a delivery cannot announce itself.
    expect(showWarning).not.toHaveBeenCalled()
  })

  it.each(['auto_click', 'auto_click_with_prompt'])(
    'stays silent for the content mode %s',
    async (mode) => {
      mockSendImage.mockResolvedValue({ success: true, mode })
      const { result, showWarning } = renderMessaging('chatgpt')

      await act(async () => {
        await result.current.sendImageToAI(PNG, { autoSend: true })
      })

      expect(showWarning).not.toHaveBeenCalled()
    }
  )

  // The image only landed in the site's input box; submitting is still pending.
  // That distinction used to be reported with a success toast — it is now
  // simply silent, because the user sees the image in the site's composer.
  it.each(['paste_only', 'paste_and_prompt'])(
    'stays silent for the content mode %s',
    async (mode) => {
      mockSendImage.mockResolvedValue({ success: true, mode })
      const { result, showWarning } = renderMessaging('chatgpt')

      await act(async () => {
        await result.current.sendImageToAI(PNG)
      })

      expect(showWarning).not.toHaveBeenCalled()
    }
  )

  it('still warns when the content send failed', async () => {
    mockSendImage.mockResolvedValue({ success: false, error: 'paste_failed' })
    const { result, showWarning } = renderMessaging('chatgpt')

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(showWarning).toHaveBeenCalled()
  })

  /**
   * Regresyon: telafi `withRollback` üzerinden döndüğü için bildirim
   * çağrısı atlanıyordu. Sonuç, **yalnızca** iptal ve başarı toast
   * üretirken gerçek bir API hatasının hiçbir yerde konuşmamasıydı.
   */
  it('still warns when an auto-sent api-chat request fails', async () => {
    mockScheduleApiChatSend.mockResolvedValue({ success: false, error: 'send_failed' })
    const { result, showWarning } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG, { autoSend: true })
    })

    expect(showWarning).toHaveBeenCalledWith('error_send_failed')
  })

  it('warns about a throw that escaped the send pipeline', async () => {
    mockScheduleApiChatSend.mockRejectedValue(new Error('boom'))
    const { result } = renderMessaging()

    let outcome: Awaited<ReturnType<typeof result.current.sendImageToAI>> | undefined
    await act(async () => {
      outcome = await result.current.sendImageToAI(PNG, { autoSend: true })
    })

    // Yakalanmamış hata mesajıyla normalize edilir; bu yol toast üretmez,
    // hata composer'da `resolveSendOutcome` ile gösterilir.
    expect(outcome).toMatchObject({ success: false, error: 'boom' })
    // Telafi yine de koşar: hazırlanan ek hedefte bırakılmaz.
    expect(mockChatUiState.addAttachment).toHaveBeenCalled()
    expect(mockChatUiState.updateInput).toHaveBeenCalled()
  })

  it('reports an in-flight cancellation as uncertain so the retry is blocked', async () => {
    // İptal belirsiz bir teslimdir. Sonuç `uncertain` taşıdığı için composer
    // "Tekrar dene"yi sunmaz; mükerrer mesajın kapısı burada kapanır.
    mockScheduleApiChatSend.mockResolvedValue({
      success: false,
      error: 'cancelled',
      stage: 'uncertain'
    })
    const { result } = renderMessaging()

    let outcome: Awaited<ReturnType<typeof result.current.sendImageToAI>> | undefined
    await act(async () => {
      outcome = await result.current.sendImageToAI(PNG, { autoSend: true })
    })

    expect(outcome).toMatchObject({ error: 'cancelled', stage: 'uncertain' })
    expect(resolveSendOutcome(outcome).resendSafe).toBe(false)
  })

  it('stays silent for a result without a mode', async () => {
    mockSendImage.mockResolvedValue({ success: true })
    const { result, showWarning } = renderMessaging('chatgpt')

    await act(async () => {
      await result.current.sendImageToAI(PNG)
    })

    expect(showWarning).not.toHaveBeenCalled()
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

/**
 * ## İçerik hazırlığı ölçümü
 *
 * `waitForContentReady` beklemesi `useAiSender`'ın `requestStartedAt`'inden
 * önce bittiği için `queueWaitMs` ve `totalMs` içinde görünmüyordu: webview'in
 * açılması/yüklenmesi için geçen gerçek süre ölçümsüz kalıyordu. Artık ayrı bir
 * metrik olarak sonuca işlenir (ek IPC/log veya içerik verisi yok).
 */
describe('useAiMessaging — content readiness measurement', () => {
  beforeEach(() => {
    mockUseAiSender.mockReturnValue({
      sendTextToAI: mockSendText,
      sendImageToAI: mockSendImage,
      sendBulkToAI: vi.fn(),
      cancelOngoing: vi.fn()
    })
    mockSendText.mockReset()
    mockSendImage.mockReset()
  })

  it('records how long the content took to become ready', async () => {
    mockSendText.mockResolvedValue({
      success: true,
      diagnostics: { timings: { queueWaitMs: 0, configResolveMs: 0, totalMs: 1 } }
    })
    const { result } = renderMessaging('chatgpt')

    let outcome: Awaited<ReturnType<typeof result.current.sendTextToAI>> | undefined
    await act(async () => {
      outcome = await result.current.sendTextToAI('hello')
    })

    const outcomeWithTimings = outcome as unknown as {
      diagnostics: { timings: Record<string, number> }
    }
    const timings = outcomeWithTimings.diagnostics.timings
    expect(typeof timings.contentReadyMs).toBe('number')
    expect(timings.contentReadyMs).toBeGreaterThanOrEqual(0)
  })

  it('never mutates the shared fallback result when the sender returns nothing', async () => {
    mockSendText.mockResolvedValue(undefined)
    const { result } = renderMessaging('chatgpt')

    let outcome: unknown
    await act(async () => {
      outcome = await result.current.sendTextToAI('hello')
    })

    expect(outcome).toBe(NO_SEND_RESULT)
    // Paylaşılan sabit nesneye metrik eklenmez (diğer çağrılara sızardı).
    expect((NO_SEND_RESULT as { diagnostics?: unknown }).diagnostics).toBeUndefined()
  })
})
