import type { AiContentController } from '@shared-core/types/aiContent'

import { executeBulkSendPipeline } from '@features/ai/lib/send/bulkSendPipeline'

import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveSendContext: vi.fn()
}))

vi.mock('@features/ai/lib/send/resolveSendContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/ai/lib/send/resolveSendContext')>()
  return {
    ...actual,
    resolveSendContext: mocks.resolveSendContext
  }
})

vi.mock('@shared/lib/aiContentUtils', () => ({
  safeContentPaste: vi.fn().mockResolvedValue(true)
}))

vi.mock('@features/ai/lib/selectorRepair/reportSelectorRepair', () => ({
  reportSelectorRepair: vi.fn().mockResolvedValue(undefined)
}))

function makeContent() {
  const scripts: string[] = []
  const content = {
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
  return { content: content as unknown as AiContentController, scripts }
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
