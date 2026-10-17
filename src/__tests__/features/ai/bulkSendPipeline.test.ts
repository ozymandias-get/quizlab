import type { AiContentController } from '@shared-core/types/aiContent'

import { resolveSendOutcome } from '@app/ui/aiSendComposer/sendOutcome'
import { executeBulkSendPipeline } from '@features/ai/lib/send/bulkSendPipeline'
import { nowMs } from '@features/ai/lib/send/sendDiagnostics'

import { describe, expect, it, vi, beforeEach } from 'vitest'

import { RESTORE_SETTLE_FLOOR_MS } from './lib/send/sharedTestHelpers'

const mocks = vi.hoisted(() => ({
  resolveSendContext: vi.fn(),
  safeContentPaste: vi.fn()
}))

vi.mock('@features/ai/lib/send/resolveSendContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/ai/lib/send/resolveSendContext')>()
  return {
    ...actual,
    resolveSendContext: mocks.resolveSendContext
  }
})

// Yapıştırmanın **iki** yolu vardır: native `content.paste()` ve JS tabanlı
// `safeContentPaste` fallback'i. "Yapıştırılamadı" senaryosunu modellemek için
// ikisinin de başarısız olması gerekir; yalnızca `content.paste`'i kapatmak
// fallback sayesinde yapıştırmayı **başarılı** kılar ve test yanlış şeyi
// ölçmeye başlar.
vi.mock('@shared/lib/aiContentUtils', () => ({
  safeContentPaste: (...args: unknown[]) => mocks.safeContentPaste(...args)
}))

vi.mock('@features/ai/lib/selectorRepair/reportSelectorRepair', () => ({
  reportSelectorRepair: vi.fn().mockResolvedValue(undefined)
}))

const electronApiMocks = vi.hoisted(() => ({
  restoreClipboard: vi.fn()
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => electronApiMocks
}))

function makeContent() {
  const scripts: string[] = []
  // Mock'lar ayrı bir nesnede tutulur: `AiContentController.paste` **isteğe
  // bağlı** bir üyeye dönüştüğünde tipi `(() => Promise<boolean>) | undefined`
  // olur ve üzerinden `.mockResolvedValue(...)` çağrılamaz. Senaryo kurulumu
  // bu yüzden tipli mock yüzeyinden yapılır.
  const mocks = {
    focus: vi.fn().mockResolvedValue(undefined),
    paste: vi.fn().mockResolvedValue(true),
    isDestroyed: vi.fn(() => false),
    getURL: vi.fn(() => 'https://chatgpt.com/'),
    executeJavaScript: vi.fn(async (script: string) => {
      scripts.push(script)
      // Every injected script "succeeds"; the submit-ready check is the one
      // that signals readiness by returning success:true with an action field.
      return { success: true, action: 'submit_ready', mode: 'mixed', diagnostics: {} }
    })
  }
  const content = mocks as unknown as AiContentController
  return { content, mocks, scripts }
}

function baseParams(content: AiContentController, scripts: string[]) {
  return {
    contentRef: { current: content },
    content,
    scheduledContent: content,
    aiRegistry: null,
    currentAI: 'chatgpt',
    queryClient: {} as never,
    configCache: { key: null, cache: null },
    activePromptText: null,
    promptText: 'Özetle',
    imageDataUrls: [
      'data:image/png;base64,AAA',
      'data:image/png;base64,BBB',
      'data:image/png;base64,CCC'
    ],
    effectiveAutoSend: true,
    textInputMode: 'auto' as never,
    typingSpeed: 0,
    requestStartedAt: Date.now(),
    diagnostics: { timings: {} } as never,
    canUseContent: () => true,
    copyImageToClipboard: vi.fn().mockResolvedValue(true),
    generateAutoSendScript: vi.fn().mockResolvedValue('/*prompt*/'),
    generateFocusScript: vi.fn().mockResolvedValue('/*focus*/'),
    generateWaitForSubmitReadyScript: vi.fn().mockResolvedValue('/*ready*/'),
    generateClickSendScript: vi.fn().mockResolvedValue('/*click*/'),
    scripts
  } as unknown as Parameters<typeof executeBulkSendPipeline>[0]
}

describe('executeBulkSendPipeline — single-message contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveSendContext.mockResolvedValue({
      aiConfig: { input: 'i', button: 'b', submitMode: 'mixed' },
      currentUrl: 'https://chatgpt.com/'
    })
    // Varsayılan: yapıştırma fallback'i çalışır. "Yapıştırılamadı" diyen testler
    // bunu **açıkça** kapatır; `clearAllMocks` uygulamayı sıfırlamadığı için
    // varsayılan her `beforeEach`'te yeniden yazılmalıdır.
    mocks.safeContentPaste.mockResolvedValue(true)
  })

  it('pastes every attachment, adds the prompt once, and clicks send once', async () => {
    const { content, scripts } = makeContent()
    const params = baseParams(content, scripts)

    const result = await executeBulkSendPipeline(params)

    expect(result.success).toBe(true)
    expect(result.mode).toBe('auto_click_with_prompt')

    // Her görsel yapıştırıldı (kopya + paste), sırayla.
    expect(params.copyImageToClipboard).toHaveBeenCalledTimes(3)
    expect(content.paste).toHaveBeenCalledTimes(3)

    // Prompt ve tıklama betikleri BİRER kez üretildi.
    expect(params.generateAutoSendScript).toHaveBeenCalledTimes(1)
    expect(params.generateClickSendScript).toHaveBeenCalledTimes(1)
    const promptCall = (params.generateAutoSendScript as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(promptCall.text).toBe('Özetle')
    expect(promptCall.submit).toBe(false)
  })

  it('verifies readiness between images instead of waiting a fixed time', async () => {
    const { content, scripts } = makeContent()
    const params = baseParams(content, scripts)

    await executeBulkSendPipeline(params)

    // 3 görsel → 2 ara hazır-olma doğrulaması (her yapıştırmadan sonra) +
    // submit öncesi 1 doğrulama = 3.
    const readyCalls = (params.generateWaitForSubmitReadyScript as ReturnType<typeof vi.fn>).mock
      .calls
    expect(readyCalls.length).toBeGreaterThanOrEqual(3)
    // Her doğrulama gerçek bir eşik/timeout ile çağrılır (sabit uyku değil).
    for (const [arg] of readyCalls) {
      expect(typeof arg.options.timeoutMs).toBe('number')
      expect(typeof arg.options.minimumWaitMs).toBe('number')
    }
  })

  it('stages without submitting when auto-send is off', async () => {
    const { content, scripts } = makeContent()
    const params = { ...baseParams(content, scripts), effectiveAutoSend: false } as Parameters<
      typeof executeBulkSendPipeline
    >[0]

    const result = await executeBulkSendPipeline(params)

    expect(result.success).toBe(true)
    expect(['paste_and_prompt', 'paste_only']).toContain(result.mode)
    // Submit için tıklama YAPILMAZ (hazırlandı, gönderilmedi).
    expect(params.generateClickSendScript).not.toHaveBeenCalled()
  })

  it('rejects a non-data URL without touching the site', async () => {
    const { content, scripts } = makeContent()
    const params = {
      ...baseParams(content, scripts),
      imageDataUrls: ['https://example.com/x.png']
    } as Parameters<typeof executeBulkSendPipeline>[0]

    const result = await executeBulkSendPipeline(params)

    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid_image_format')
    expect(content.paste).not.toHaveBeenCalled()
  })

  it('keeps the clipboard restore path and never submits twice', async () => {
    const { content, scripts } = makeContent()
    const params = baseParams(content, scripts)

    await executeBulkSendPipeline(params)

    const clickScripts = scripts.filter((s) => s === '/*click*/')
    expect(clickScripts).toHaveLength(1)
  })
})

/**
 * ## Kısmi uygulama → güvensiz otomatik retry
 *
 * `paste_failed` kodu tek başına "hiçbir şey olmadı" demek değildir: üçüncü
 * görselde döndüğünde ilk ikisi hedef kutunun içindedir. Bu dosya her senaryo
 * için **iki şeyi** birlikte doğrular:
 *
 * 1. Pipeline gerçekte ne kadar ilerlediğini `stage` ile bildiriyor mu?
 * 2. O aşama, `resolveSendOutcome`'un otomatik tekrarı kapatmasını sağlıyor mu?
 *
 * "İkinci kopya oluşmadığını" doğrulamak için `resolveSendOutcome` üzerinden
 * gidilir: `resendSafe: false` geliyorsa composer "Tekrar dene"yi sunmaz.
 */
describe('executeBulkSendPipeline — partial application is never auto-resendable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveSendContext.mockResolvedValue({
      aiConfig: { input: 'i', button: 'b', submitMode: 'mixed' },
      currentUrl: 'https://chatgpt.com/'
    })
    // Varsayılan: yapıştırma fallback'i çalışır. "Yapıştırılamadı" diyen testler
    // bunu **açıkça** kapatır; `clearAllMocks` uygulamayı sıfırlamadığı için
    // varsayılan her `beforeEach`'te yeniden yazılmalıdır.
    mocks.safeContentPaste.mockResolvedValue(true)
  })

  /** Pipeline sonucunu composer'ın gördüğü gönderim durumuna çevirir. */
  const asOutcome = (result: Awaited<ReturnType<typeof executeBulkSendPipeline>>) =>
    resolveSendOutcome(result)

  it('reports not_started when the FIRST image cannot be pasted (retry is safe)', async () => {
    const { content, mocks: contentMocks, scripts } = makeContent()
    // Her iki yapıştırma yolu da başarısız: hedefe hiçbir şey girmedi.
    contentMocks.paste.mockResolvedValue(false)
    mocks.safeContentPaste.mockResolvedValue(false)
    const params = baseParams(content, scripts)

    const result = await executeBulkSendPipeline(params)

    expect(result.success).toBe(false)
    expect(result.error).toBe('paste_failed')
    expect(result.stage).toBe('not_started')

    const outcome = asOutcome(result)
    expect(outcome.kind).toBe('failed')
    expect(outcome.resendSafe).toBe(true)
  })

  it('reports partial when the SECOND image fails after one landed', async () => {
    const { content, mocks: contentMocks, scripts } = makeContent()
    // İlk yapıştırma başarılı, ikincisi (ve fallback'i) başarısız.
    contentMocks.paste.mockResolvedValueOnce(true).mockResolvedValue(false)
    mocks.safeContentPaste.mockResolvedValue(false)
    const params = baseParams(content, scripts)

    const result = await executeBulkSendPipeline(params)

    expect(result.error).toBe('paste_failed')
    expect(result.stage).toBe('partial')

    const outcome = asOutcome(result)
    // Otomatik tekrar kapalı: yoksa aynı görseller ikinci kez yapıştırılır.
    expect(outcome.kind).toBe('incomplete')
    expect(outcome.resendSafe).toBe(false)
  })

  it('reports partial when the THIRD image fails after two landed', async () => {
    const { content, mocks: contentMocks, scripts } = makeContent()
    contentMocks.paste
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false)
    mocks.safeContentPaste.mockResolvedValue(false)
    const params = baseParams(content, scripts)

    const result = await executeBulkSendPipeline(params)

    expect(content.paste).toHaveBeenCalledTimes(3)
    expect(result.stage).toBe('partial')
    expect(asOutcome(result).resendSafe).toBe(false)
  })

  it('reports partial when the clipboard dies after earlier images landed', async () => {
    const { content, scripts } = makeContent()
    const params = baseParams(content, scripts)
    // İlk görsel kopyalanır, ikincinin kopyalanması başarısız olur.
    ;(params.copyImageToClipboard as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false)

    const result = await executeBulkSendPipeline(params)

    expect(result.error).toBe('clipboard_failed')
    expect(result.stage).toBe('partial')
    expect(asOutcome(result).resendSafe).toBe(false)
  })

  it('reports partial when every image landed but the prompt script fails', async () => {
    const { content, scripts } = makeContent()
    const params = baseParams(content, scripts)
    ;(params.generateAutoSendScript as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await executeBulkSendPipeline(params)

    expect(content.paste).toHaveBeenCalledTimes(3)
    expect(result.stage).toBe('partial')
    expect(asOutcome(result).resendSafe).toBe(false)
  })

  it('reports partial when images and prompt are ready but submit-ready fails', async () => {
    const { content, scripts } = makeContent()
    const params = baseParams(content, scripts)
    // 3 görsel → 2 **ara** hazır-olma doğrulaması + submit öncesi 1 doğrulama.
    // Senaryo "görseller yapıştırıldı, prompt yazıldı, ancak submit-ready
    // başarısız" olduğu için ara doğrulamalar **geçmeli**, yalnızca sonuncu
    // üretilememeli. Hepsi birden başarısız olsaydı pipeline ikinci görselden
    // önce durur ve bu senaryo hiç ölçülmezdi.
    ;(params.generateWaitForSubmitReadyScript as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('/*ready*/')
      .mockResolvedValueOnce('/*ready*/')
      .mockResolvedValue(null)

    const result = await executeBulkSendPipeline(params)

    expect(content.paste).toHaveBeenCalledTimes(3)
    // Pipeline dürüst bir aşama bildirir: hedefe **her şey** yazıldı
    // (3 görsel + prompt), yalnızca submit tıklaması yapılmadı.
    expect(result.stage).toBe('applied')

    // ...ama başarısız bir sonuçta `applied` "güvenle tekrar gönderilebilir"
    // demek **değildir**: kutu dolu, aynı içeriği tekrar yollamak ikinci bir
    // kopya bırakır. Karar aşamadan tek başına değil, hata + aşama
    // birleşiminden okunur.
    const outcome = asOutcome(result)
    expect(outcome.kind).toBe('incomplete')
    expect(outcome.resendSafe).toBe(false)
  })

  it('reports partial when the webview closes after the second image', async () => {
    const { content, scripts } = makeContent()
    const params = baseParams(content, scripts)
    let pasteCalls = 0
    // İki yapıştırmadan sonra webview yok edilmiş gibi davran.
    params.canUseContent = (() => {
      pasteCalls += 1
      return pasteCalls <= 3
    }) as unknown as typeof params.canUseContent

    const result = await executeBulkSendPipeline(params)

    expect(result.error).toBe('webview_destroyed')
    expect(result.stage).toBe('partial')
    expect(asOutcome(result).resendSafe).toBe(false)
  })

  it('keeps autosend_failed_draft_saved incomplete (V3 contract preserved)', async () => {
    const { content, scripts } = makeContent()
    const params = baseParams(content, scripts)
    // Tıkla gönder betiği üretilemez → click adımı başarısız.
    ;(params.generateClickSendScript as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await executeBulkSendPipeline(params)

    expect(result.error).toBe('autosend_failed_draft_saved')
    expect(asOutcome(result).kind).toBe('incomplete')
    expect(asOutcome(result).resendSafe).toBe(false)
  })

  it('reports applied for a delivered send so the composer can confirm it', async () => {
    const { content, scripts } = makeContent()
    const params = baseParams(content, scripts)

    const result = await executeBulkSendPipeline(params)

    expect(result.stage).toBe('applied')
    expect(asOutcome(result).kind).toBe('delivered')
  })

  it('reports applied for a staged send, never as delivered', async () => {
    const { content, scripts } = makeContent()
    const params = {
      ...baseParams(content, scripts),
      effectiveAutoSend: false
    } as Parameters<typeof executeBulkSendPipeline>[0]

    const result = await executeBulkSendPipeline(params)

    expect(result.stage).toBe('applied')
    // Auto-send kapalı: teslim iddiası yok, "hazırlandı" denir.
    expect(asOutcome(result).kind).toBe('staged')
  })

  it('treats a non-data URL as not_started before anything is written', async () => {
    const { content, scripts } = makeContent()
    const params = {
      ...baseParams(content, scripts),
      imageDataUrls: ['data:image/png;base64,AAA', 'https://example.com/x.png']
    } as Parameters<typeof executeBulkSendPipeline>[0]

    const result = await executeBulkSendPipeline(params)

    expect(result.error).toBe('invalid_image_format')
    expect(content.paste).not.toHaveBeenCalled()
    expect(asOutcome(result).resendSafe).toBe(true)
  })
})

/**
 * ## Pano geri yükleme yaşam döngüsü
 *
 * Görsel gönderimi kullanıcının panosunu ödünç alır ve **tam olarak bir kez**
 * geri vermek zorundadır. Geri yükleme ayrıca kritik yoldan çıkarılmıştır:
 * settle + IPC süresi prompt/submit adımlarını bekletmemelidir — aksi halde
 * her görsel gönderimine sabit ~700ms gecikme eklerdi.
 */
describe('executeBulkSendPipeline — clipboard restore lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveSendContext.mockResolvedValue({
      aiConfig: { input: 'i', button: 'b', submitMode: 'mixed' },
      currentUrl: 'https://chatgpt.com/'
    })
    mocks.safeContentPaste.mockResolvedValue(true)
  })

  it('restores the clipboard exactly once and off the prompt/submit critical path', async () => {
    const { content, mocks: contentMocks, scripts } = makeContent()
    const params = baseParams(content, scripts)

    let lastPasteAt = 0
    contentMocks.paste.mockImplementation(async () => {
      lastPasteAt = Date.now()
      return true
    })

    const focusGeneratedAt: number[] = []
    ;(params.generateFocusScript as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      focusGeneratedAt.push(Date.now())
      return '/*focus*/'
    })

    const result = await executeBulkSendPipeline(params)

    expect(result.success).toBe(true)
    // Tam olarak bir kez geri yükleme: `void restore()` ile arka planda
    // başlatılan iş, `finally`'de aynı memoize edilmiş promise üzerinden
    // beklenir.
    expect(electronApiMocks.restoreClipboard).toHaveBeenCalledTimes(1)
    const timings = (params.diagnostics as unknown as { timings: Record<string, number> }).timings
    expect(typeof timings.clipboardRestoreMs).toBe('number')

    // Son yapıştırmadan sonraki refocus (prompt adımı), settle beklemesi
    // bitmeden başlamış olmalı: kritik yolda 700ms'lik bekleme yok.
    const refocusAt = focusGeneratedAt.find((ts) => ts >= lastPasteAt)
    expect(refocusAt).toBeDefined()
    expect((refocusAt as number) - lastPasteAt).toBeLessThan(700)
  }, 20000)

  it('restores the clipboard even when the tab dies right after the first paste', async () => {
    const { content, mocks: contentMocks, scripts } = makeContent()
    // İlk görsel yapıştırıldıktan sonra sekme ölür: ara hazırlık betiği
    // webview_destroyed döner ve akış yarıda kesilir.
    // Mock yüzeyi genişletilir: ara adımlar webview_destroyed döndürür.
    ;(contentMocks.executeJavaScript as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ success: true, action: 'focus', mode: 'mixed', diagnostics: {} })
      .mockResolvedValue({
        success: false,
        action: 'submit_ready',
        mode: 'mixed',
        diagnostics: {},
        error: 'webview_destroyed'
      })
    const params = baseParams(content, scripts)

    const result = await executeBulkSendPipeline(params)

    expect(result.success).toBe(false)
    // Yarım kalan gönderim bile panoyu geri vermek zorunda: `finally` çalışır
    // ve restore TAM olarak kopyanın sahiplik kapsamıyla eşleşir.
    expect(electronApiMocks.restoreClipboard).toHaveBeenCalledTimes(1)
    const copyCalls = (params.copyImageToClipboard as ReturnType<typeof vi.fn>).mock.calls
    expect(copyCalls.length).toBeGreaterThanOrEqual(1)
    expect(electronApiMocks.restoreClipboard).toHaveBeenCalledWith(copyCalls[0][1])
  }, 20000)

  it('uses one ownership scope for every image copy and restores with that exact scope', async () => {
    const { content, scripts } = makeContent()
    const params = baseParams(content, scripts)

    const result = await executeBulkSendPipeline(params)

    expect(result.success).toBe(true)
    const copyCalls = (params.copyImageToClipboard as ReturnType<typeof vi.fn>).mock.calls
    expect(copyCalls).toHaveLength(3)
    // Üç görsel TEK sahiplik kapsamı paylaşır: ana süreç gönderim başına tek
    // snapshot açar (eski davranışta N−1 yetim snapshot kalıyordu).
    const scopes = new Set(copyCalls.map(([, scope]) => scope))
    expect(scopes.size).toBe(1)
    const [scope] = [...scopes]
    expect(typeof scope).toBe('string')
    expect(electronApiMocks.restoreClipboard).toHaveBeenCalledTimes(1)
    expect(electronApiMocks.restoreClipboard).toHaveBeenCalledWith(scope)
  }, 20000)

  it('finalizes totalMs after the finally and records the real restore wait', async () => {
    const { content, scripts } = makeContent()
    // Prompt'suz yol: restore başladıktan sonra pipeline'da BAŞKA bekleme
    // yoktur; `finally`'nin beklediği gerçek süre ölçülebilir olur.
    const params = {
      ...baseParams(content, scripts),
      effectiveAutoSend: false,
      promptText: undefined,
      // Üretimde olduğu gibi performans tabanlı başlangıç: `totalMs`
      // `nowMs() - requestStartedAt` olarak hesaplanır.
      requestStartedAt: nowMs()
    } as Parameters<typeof executeBulkSendPipeline>[0]

    const result = await executeBulkSendPipeline(params)

    expect(result.success).toBe(true)
    expect(result.mode).toBe('paste_only')
    const timings = (params.diagnostics as unknown as { timings: Record<string, number> }).timings
    // Paste adımları neredeyse anlık (mock); totalMs'in tamamına yakını
    // `finally`'deki settle beklemesidir.
    expect(timings.pasteMs ?? 0).toBeLessThan(RESTORE_SETTLE_FLOOR_MS)
    expect(typeof timings.clipboardRestoreWaitMs).toBe('number')
    expect(timings.clipboardRestoreWaitMs).toBeGreaterThanOrEqual(RESTORE_SETTLE_FLOOR_MS)
    // `>= RESTORE_SETTLE_MS` DEĞİL: setTimeout tabanlı bekleme, `performance.now()`
    // farkı olarak birebir kendi süresini garanti etmez (bkz. TIMER_TOLERANCE_MS).
    // Değişmez olan sıralamadır: toplam süre restore beklemesini kapsar.
    expect(timings.totalMs).toBeGreaterThanOrEqual(RESTORE_SETTLE_FLOOR_MS)
    expect(timings.totalMs).toBeGreaterThanOrEqual(timings.clipboardRestoreWaitMs)
    // Sonuç, `finally` sonrası hesaplanan AYNI diagnostics nesnesini taşır.
    expect(result.diagnostics?.timings.totalMs).toBe(timings.totalMs)
  }, 20000)
})
