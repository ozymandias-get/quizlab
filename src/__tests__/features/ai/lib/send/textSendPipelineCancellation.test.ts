/**
 * İptal, script çalışırken gelirse sonuç nasıl raporlanır?
 *
 * `executePipelineStep` iptali `executeJavaScript` çağrısından **önce**
 * kontrol eder. Script zaten çalışmaya başladıysa iptal onu geri alamaz:
 * metin alana yazılmış, hatta gönder tuşuna basılmış olabilir. Bu yüzden
 * scriptin döndürdüğü gerçek sonuç raporlanır; "iptal edildi" diye
 * değiştirilmez ve doğrulanmamış bir teslimat başarıya dönüştürülmez.
 *
 * Bu dosya o kuralın dört sonuç biçimini ve aşama/retry eşlemesini sabitler.
 * Buradaki beklentiler değişirse kullanıcıya gösterilen gönderim durumu
 * sessizce yanlışlaşır.
 */
import type { AiContentController } from '@shared-core/types/aiContent'

import { resolveSendOutcome } from '@app/ui/aiSendComposer/sendOutcome'
import { cancelContentSends } from '@features/ai/lib/aiSenderSupport'
import { executeTextSendPipeline } from '@features/ai/lib/send/textSendPipeline'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ resolveSendContext: vi.fn() }))

vi.mock('@features/ai/lib/send/resolveSendContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/ai/lib/send/resolveSendContext')>()
  return { ...actual, resolveSendContext: mocks.resolveSendContext }
})

vi.mock('@features/ai/lib/selectorRepair/reportSelectorRepair', () => ({
  reportSelectorRepair: vi.fn().mockResolvedValue(undefined)
}))

type ScriptResult = Record<string, unknown>

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function makeContent(scriptResult: Promise<ScriptResult>) {
  const surface = {
    isDestroyed: vi.fn(() => false),
    getURL: vi.fn(() => 'https://chatgpt.com/'),
    executeJavaScript: vi.fn(async () => scriptResult)
  }
  return surface as unknown as AiContentController
}

function baseParams(content: AiContentController, autoSend: boolean) {
  return {
    contentRef: { current: content },
    content,
    scheduledContent: content,
    aiRegistry: null,
    currentAI: 'chatgpt',
    queryClient: {} as never,
    configCache: { key: null, cache: null },
    activePromptText: null,
    promptText: undefined,
    text: 'Merhaba',
    effectiveAutoSend: autoSend,
    textInputMode: 'auto' as never,
    typingSpeed: 0,
    requestStartedAt: Date.now(),
    diagnostics: { timings: {} } as never,
    canUseContent: () => true,
    generateAutoSendScript: vi.fn().mockResolvedValue('/*send*/')
  } as unknown as Parameters<typeof executeTextSendPipeline>[0]
}

/**
 * Scripti bekletir, bu arada isteği iptal eder, sonra scriptin gerçek
 * sonucunu döndürür.
 */
async function sendThenCancel(
  scriptResult: ScriptResult,
  autoSend: boolean
): Promise<{
  content: AiContentController
  result: Awaited<ReturnType<typeof executeTextSendPipeline>>
}> {
  const gate = deferred<ScriptResult>()
  const content = makeContent(gate.promise)
  const run = executeTextSendPipeline(baseParams(content, autoSend))
  await vi.waitFor(() => expect(content.executeJavaScript).toHaveBeenCalledTimes(1))
  cancelContentSends(content)
  gate.resolve(scriptResult)
  return { content, result: await run }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolveSendContext.mockResolvedValue({
    aiConfig: { input: 'i', button: 'b', submitMode: 'mixed' },
    currentUrl: 'https://chatgpt.com/'
  })
})

describe('a text send cancelled while its script runs', () => {
  it('reports a delivery the script observed as delivered, cancel or not', async () => {
    const { result } = await sendThenCancel(
      { success: true, action: 'submit', mode: 'click', submitOutcome: 'observed' },
      true
    )

    expect(result).toMatchObject({
      success: true,
      stage: 'applied',
      submitOutcome: 'observed'
    })
    expect(resolveSendOutcome(result)).toMatchObject({ kind: 'delivered', resendSafe: true })
  })

  it('keeps an unverified submit as uncertain instead of a silent success', async () => {
    const { result } = await sendThenCancel(
      { success: true, action: 'submit', mode: 'click' },
      true
    )

    expect(result).toMatchObject({
      success: true,
      stage: 'uncertain',
      submitOutcome: 'delivery_unconfirmed'
    })
    const outcome = resolveSendOutcome(result)
    expect(outcome.kind).toBe('incomplete')
    expect(outcome.resendSafe).toBe(false)
  })

  it('reports a staged write as staged, not as a delivery', async () => {
    const { result } = await sendThenCancel(
      { success: true, action: 'input', mode: 'input' },
      false
    )

    expect(result).toMatchObject({
      success: true,
      stage: 'applied',
      submitOutcome: 'input_only'
    })
    expect(resolveSendOutcome(result)).toMatchObject({ kind: 'staged', resendSafe: true })
  })

  it('reports a failed script as failed, with the code it returned', async () => {
    const { result } = await sendThenCancel({ success: false, error: 'input_not_found' }, true)

    expect(result).toMatchObject({ success: false, error: 'input_not_found', stage: 'not_started' })
    expect(resolveSendOutcome(result)).toMatchObject({
      kind: 'failed',
      errorCode: 'input_not_found',
      resendSafe: true
    })
  })

  it('treats the page-side abort the script reports as partial, never as retryable', async () => {
    // Navigasyon sırasında sayfa kendi çalışmasını durdurur ve 'cancelled'
    // döner: metin yazımı başlamış olabileceği için tekrar güvenli değildir.
    const { result } = await sendThenCancel(
      { success: false, error: 'cancelled', submitOutcome: 'not_attempted' },
      true
    )

    expect(result).toMatchObject({ success: false, error: 'cancelled', stage: 'partial' })
    const outcome = resolveSendOutcome(result)
    expect(outcome.kind).toBe('incomplete')
    expect(outcome.resendSafe).toBe(false)
  })
})
