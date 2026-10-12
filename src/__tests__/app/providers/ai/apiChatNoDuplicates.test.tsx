/**
 * api-chat yolunda **mükerrer ek** oluşmaması.
 *
 * api-chat, içeriği önce sekmenin deposuna yazar, sonra istek atar. Yazma ile
 * istek arasında bir hata olursa (görsel hazırlanamadı, ağ hatası, zaman aşımı)
 * yazılan içerik yerinde kalır ve kullanıcı "Tekrar gönder" dediğinde aynı
 * görseller ikinci kez eklenir — istenen tek mesaj sessizce iki mesaja dönüşür.
 *
 * Bu dosya o senaryoların tamamını uçtan uca doğrular; telafi mantığının birim
 * testleri `apiChatStaging.test.ts` içindedir.
 */
import type { AiContentController } from '@shared-core/types/aiContent'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TAB = 'tab-1'
const PNG = 'data:image/png;base64,iVBORw0KGgo='

/** Gerçek davranışı taklit eden depo: mutasyonlar state'i değiştirir. */
const store = {
  input: '' as string,
  attachments: [] as string[],
  reset() {
    store.input = ''
    store.attachments = []
  }
}

// Depo sözleşmesi: `removeAttachment(tabId, index)` — dizin **ikinci** argümandır.
const removeAttachment = vi.fn((_tabId: string, index: number) => {
  store.attachments = store.attachments.filter((_, i) => i !== index)
})

const mockScheduleApiChatSend = vi.fn()
const mockPrepareImageForUpload = vi.fn(async (url: string) => url)
const mockSendText = vi.fn()
const mockSendImage = vi.fn()
const mockSendBulk = vi.fn()

vi.mock('@features/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@features/ai')>()),
  useAiSender: () => ({
    sendTextToAI: mockSendText,
    sendImageToAI: mockSendImage,
    sendBulkToAI: mockSendBulk,
    cancelOngoing: vi.fn()
  }),
  resolveAutoSend: (autoSend: boolean, options?: { autoSend?: boolean }) =>
    options?.autoSend ?? autoSend,
  useChatUiStore: {
    getState: () => ({
      inputValueByTab: { [TAB]: store.input },
      attachmentsByTab: { [TAB]: store.attachments },
      updateInput: (_tabId: string, value: string) => {
        store.input = value
      },
      addAttachment: (_tabId: string, data: string) => {
        store.attachments.push(data)
      },
      removeAttachment
    })
  },
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

function renderMessaging(autoSend = true) {
  const showSuccess = vi.fn()
  const showWarning = vi.fn()
  const { result } = renderHook(() =>
    useAiMessaging({
      getContentController: vi.fn(() => null as AiContentController | null),
      getActiveTab: vi.fn(() => ({ id: TAB, modelId: 'api-chat' })),
      currentAI: 'api-chat',
      activeTabId: TAB,
      autoSend,
      aiRegistry: {},
      showSuccess,
      showWarning,
      openAiWorkspace: vi.fn()
    })
  )
  return { result, showSuccess, showWarning }
}

describe('api-chat — no duplicate attachments after a failure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.reset()
    mockPrepareImageForUpload.mockImplementation(async (url: string) => url)
    mockScheduleApiChatSend.mockResolvedValue({ success: true })
  })

  it('adds nothing when preparing the second of three images fails', async () => {
    // Görseller sırayla hazırlanır; 2.'si patlarsa ilk eklenmiş **olmamalı**,
    // yoksa yeniden denemede mükerrer ek kalır.
    mockPrepareImageForUpload
      .mockImplementationOnce(async (url: string) => url)
      .mockRejectedValueOnce(new Error('canvas exploded'))
      .mockImplementation(async (url: string) => url)
    const { result } = renderMessaging()

    let outcome: { success: boolean } | undefined
    await act(async () => {
      outcome = (await result.current.sendBulkToAI?.([PNG, PNG, PNG])) as { success: boolean }
    })

    expect(outcome?.success).toBe(false)
    expect(store.attachments).toEqual([])
    expect(mockScheduleApiChatSend).not.toHaveBeenCalled()
  })

  it('removes the attachments it staged when the submit fails', async () => {
    mockScheduleApiChatSend.mockResolvedValue({ success: false, error: 'send_failed' })
    const { result } = renderMessaging()

    let outcome: { success: boolean } | undefined
    await act(async () => {
      outcome = (await result.current.sendBulkToAI?.([PNG, PNG])) as { success: boolean }
    })

    expect(outcome?.success).toBe(false)
    // Kesin başarısızlık: hazırlanan ekler geri alınır.
    expect(store.attachments).toEqual([])
  })

  it('leaves the attachments in place when the send succeeds', async () => {
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendBulkToAI?.([PNG, PNG])
    })

    expect(store.attachments).toHaveLength(2)
  })

  it('keeps attachments the user staged before the send', async () => {
    store.attachments = ['data:image/png;base64,USER']
    mockScheduleApiChatSend.mockResolvedValue({ success: false, error: 'send_failed' })
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendBulkToAI?.([PNG])
    })

    // Telafi yalnızca bu katmanın eklediğini düşürür.
    expect(store.attachments).toEqual(['data:image/png;base64,USER'])
  })

  it('restores the composer text the user had written', async () => {
    store.input = 'Existing question'
    mockScheduleApiChatSend.mockResolvedValue({ success: false, error: 'send_failed' })
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendBulkToAI?.([PNG], { promptText: 'Explain this' })
    })

    expect(store.input).toBe('Existing question')
  })

  it('keeps the staged content when auto-send is off (nothing was delivered)', async () => {
    // Auto-send kapalı: teslim yok, dolayısıyla geri alma da yok — içerik
    // kullanıcının AI kutusunda hazır beklemelidir.
    const { result } = renderMessaging(false)

    let outcome: { success: boolean; mode?: string } | undefined
    await act(async () => {
      outcome = (await result.current.sendBulkToAI?.([PNG, PNG], {
        promptText: 'Explain'
      })) as { success: boolean; mode?: string }
    })

    expect(outcome?.mode).toBe('staged')
    expect(store.attachments).toHaveLength(2)
    expect(store.input).toBe('Explain')
  })

  it('a retry after a failure does not duplicate anything', async () => {
    mockScheduleApiChatSend.mockResolvedValueOnce({ success: false, error: 'send_failed' })
    mockScheduleApiChatSend.mockResolvedValueOnce({ success: true })
    const { result } = renderMessaging()

    let first: { success: boolean } | undefined
    await act(async () => {
      first = (await result.current.sendBulkToAI?.([PNG, PNG], {
        promptText: 'Explain'
      })) as { success: boolean }
    })
    expect(first?.success).toBe(false)

    await act(async () => {
      await result.current.sendBulkToAI?.([PNG, PNG], { promptText: 'Explain' })
    })

    // İkinci denemede tam olarak iki ek ve tek talimat var — dört değil.
    expect(store.attachments).toHaveLength(2)
    expect(store.input).toBe('Explain')
  })

  it('stages the single-image turn the same way', async () => {
    mockScheduleApiChatSend.mockResolvedValue({ success: false, error: 'send_failed' })
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendImageToAI(PNG, { promptText: 'Explain this' })
    })

    expect(store.attachments).toEqual([])
    expect(store.input).toBe('')
  })
})
