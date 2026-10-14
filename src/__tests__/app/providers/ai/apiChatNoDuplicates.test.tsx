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

import { resolveSendOutcome } from '@app/ui/aiSendComposer/sendOutcome'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AiSendResult } from '@app/providers/ai/types'

const TAB = 'tab-1'
const PNG = 'data:image/png;base64,iVBORw0KGgo='

/** Gerçek davranışı taklit eden depo: mutasyonlar state'i değiştirir. */
const store = {
  input: '' as string,
  attachments: [] as string[],
  /**
   * Gerçek `chatUiStore` gibi eklenti listesi mutasyon sayacı. Telafi, "bizim
   * eklediğimiz kopyalar hâlâ bizim mi?" sorusunu bu sayıya sorar; sayaç
   * bildirmeyen bir depo o soruya güvenli tarafla (silmeden) yanıt verir.
   */
  revision: 0,
  /**
   * Hata enjeksiyonu: `addAttachment` bu çağrı numarasında **önce yazar, sonra
   * patlar**. "Yazma başladı ama hata verdi" durumu mutasyon kaydının neden
   * uygulamadan önce yazıldığını gösteren tek senaryodur.
   */
  failAddOnCall: 0,
  addCalls: 0,
  reset() {
    store.input = ''
    store.attachments = []
    store.revision = 0
    store.failAddOnCall = 0
    store.addCalls = 0
  }
}

// Depo sözleşmesi: `removeAttachment(tabId, index)` — dizin **ikinci** argümandır.
const removeAttachment = vi.fn((_tabId: string, index: number) => {
  store.attachments = store.attachments.filter((_, i) => i !== index)
  store.revision += 1
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
      attachmentsRevisionByTab: { [TAB]: store.revision },
      updateInput: (_tabId: string, value: string) => {
        store.input = value
      },
      addAttachment: (_tabId: string, data: string) => {
        store.addCalls += 1
        store.attachments.push(data)
        store.revision += 1
        if (store.failAddOnCall === store.addCalls) {
          throw new Error('store write failed after mutating')
        }
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
  const showWarning = vi.fn()
  const { result } = renderHook(() =>
    useAiMessaging({
      getContentController: vi.fn(() => null as AiContentController | null),
      getActiveTab: vi.fn(() => ({ id: TAB, modelId: 'api-chat' })),
      currentAI: 'api-chat',
      activeTabId: TAB,
      autoSend,
      aiRegistry: {},
      showWarning,
      openAiWorkspace: vi.fn()
    })
  )
  return { result, showWarning }
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

/**
 * Hazırlama sırasında oluşan hatalar ve sahiplik.
 *
 * `runApiChatSend` artık bir "hazırlandı" bayrağı değil, **işlem günlüğünde
 * kayıt olup olmamasına** bakar. Buradaki testler bu sözleşmenin zor tarafını
 * ölçer: depo işlevi yazdıktan **sonra** patladığında geri alınacak bir şey
 * vardır ve kullanıcının kendi verisi karışmamalıdır.
 */
describe('api-chat — staging that fails mid-write and ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.reset()
    mockPrepareImageForUpload.mockImplementation(async (url: string) => url)
    mockScheduleApiChatSend.mockResolvedValue({ success: true })
  })

  it('reverts an attachment whose store write threw after mutating', async () => {
    store.failAddOnCall = 1
    const { result } = renderMessaging()

    let outcome: AiSendResult | undefined
    await act(async () => {
      outcome = await result.current.sendBulkToAI?.([PNG])
    })

    // Yazma gerçekten olmuştu; telafi onu geri aldı ve hedef eski halinde.
    expect(store.attachments).toEqual([])
    expect(outcome?.success).toBe(false)
    expect(resolveSendOutcome(outcome).resendSafe).toBe(true)
  })

  it('keeps the user attachment when automation stages the very same image', async () => {
    // Saf içerik eşleşmesi (`indexOf`) burada kullanıcının kopyasını bulur ve
    // otomasyonun ekini bırakırdı: hem kullanıcı verisi gider hem mükerrer ek
    // kalırdı. Sahiplik "kaçıncı kopya" üzerinden kurulur.
    store.attachments = [PNG]
    mockScheduleApiChatSend.mockResolvedValue({ success: false, error: 'send_failed' })
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendBulkToAI?.([PNG])
    })

    // Kullanıcının kopyası durur, otomasyonunki düşer.
    expect(store.attachments).toEqual([PNG])
  })

  it('keeps both copies distinct when the same image is staged twice', async () => {
    store.attachments = [PNG]
    mockScheduleApiChatSend.mockResolvedValue({ success: false, error: 'send_failed' })
    const { result } = renderMessaging()

    await act(async () => {
      await result.current.sendBulkToAI?.([PNG, PNG])
    })

    // Kullanıcının kopyası + otomasyonun iki kopyası → telafide yalnızca
    // otomasyonun iki kopyası düşer, biri kalır.
    expect(store.attachments).toEqual([PNG])
  })

  it('never auto-resends when the user edited the composer before rollback', async () => {
    store.input = 'Existing'
    // Kullanıcı **istek sürerken** araya yazar; yani telafi çalışmadan
    // ÖNCE. Telafi metni silmeye çalışırsa kullanıcının verisini bozardı.
    mockScheduleApiChatSend.mockImplementationOnce(async () => {
      store.input = `${store.input}\nve ayrıca şunu da`
      return { success: false, error: 'send_failed' }
    })
    const { result } = renderMessaging()

    let outcome: AiSendResult | undefined
    await act(async () => {
      outcome = await result.current.sendBulkToAI?.([PNG], { promptText: 'Explain' })
    })

    // Kullanıcının metni korunur; otomasyonun talimatı da silinmez, çünkü
    // artık sondaki ek değil.
    expect(store.input).toBe('Existing\nExplain\nve ayrıca şunu da')
    // Telafi tamamlanamadı → sonuç belirsiz → otomatik tekrar kapalı.
    expect(resolveSendOutcome(outcome).resendSafe).toBe(false)
  })

  it('rolls back and stays retryable when cancelled before the request started', async () => {
    // Debounce penceresinde iptal: flush hiç çalışmadı, hiçbir istek atılmadı.
    // Telafi hem güvenli hem **gereklidir** — yoksa hazırlanan görseller
    // kutuda kalır ve bir sonraki denemede ikinci kez eklenir.
    mockScheduleApiChatSend.mockResolvedValue({
      success: false,
      error: 'cancelled_before_send',
      stage: 'not_started'
    })
    const { result } = renderMessaging()

    let outcome: AiSendResult | undefined
    await act(async () => {
      outcome = await result.current.sendBulkToAI?.([PNG, PNG], { promptText: 'Explain' })
    })

    // Hedef tam olarak eski halinde → telafi tam → otomatik tekrar açık.
    expect(store.attachments).toEqual([])
    expect(store.input).toBe('')
    expect(resolveSendOutcome(outcome).resendSafe).toBe(true)
  })

  it('does not roll back after an in-flight cancellation', async () => {
    // İstek atıldıktan sonra iptal: kullanıcı mesajı transcript'e yazılmış
    // olabilir. Geri almak ikinci bir kopya üretirdi; bu yüzden hazırlanan
    // içerik yerinde bırakılır ve tekrar kapalıdır.
    mockScheduleApiChatSend.mockResolvedValue({
      success: false,
      error: 'cancelled',
      stage: 'uncertain'
    })
    const { result } = renderMessaging()

    let outcome: AiSendResult | undefined
    await act(async () => {
      outcome = await result.current.sendBulkToAI?.([PNG], { promptText: 'Explain' })
    })

    expect(store.attachments).toEqual([PNG])
    expect(resolveSendOutcome(outcome).resendSafe).toBe(false)
  })

  it('rolls back the attachment but keeps the user text when rollback is partial', async () => {
    store.input = 'Existing'
    mockScheduleApiChatSend.mockImplementationOnce(async () => {
      store.input = `${store.input}\nve ayrıca şunu da`
      return { success: false, error: 'send_failed' }
    })
    const { result } = renderMessaging()

    let outcome: AiSendResult | undefined
    await act(async () => {
      outcome = await result.current.sendBulkToAI?.([PNG], { promptText: 'Explain' })
    })

    // Ek geri alındı (mükerrer ek kalmaz), metin kullanıcıya ait olduğu için
    // korunur. Sonuç yine de "tam telafi" değildir.
    expect(store.attachments).toEqual([])
    expect(store.input).toContain('ve ayrıca şunu da')
    expect(resolveSendOutcome(outcome).kind).toBe('incomplete')
  })
})
