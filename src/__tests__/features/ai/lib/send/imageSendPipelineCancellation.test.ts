/**
 * Tek görsel gönderiminde iptal ile yapıştırma arasındaki yarış.
 *
 * Focus adımı kendi iptal kontrolünü yapar, ancak bu kontrol betik
 * çalışmadan **önce**dir. Kullanıcı betik çalışırken iptal ederse, dönen
 * yanıttan sonra yapıştırma yine de çalışır ve eski isteğin görseli yeni
 * taslağa karışır. Bu dosya tam o pencereyi ölçer.
 */
import type { AiContentController } from '@shared-core/types/aiContent'

import { cancelContentSends } from '@features/ai/lib/aiSenderSupport'
import { executeImageSendPipeline } from '@features/ai/lib/send/imageSendPipeline'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveSendContext: vi.fn(),
  safeContentPaste: vi.fn()
}))

vi.mock('@features/ai/lib/send/resolveSendContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/ai/lib/send/resolveSendContext')>()
  return { ...actual, resolveSendContext: mocks.resolveSendContext }
})

vi.mock('@shared/lib/aiContentUtils', () => ({
  safeContentPaste: (...args: unknown[]) => mocks.safeContentPaste(...args)
}))

vi.mock('@features/ai/lib/selectorRepair/reportSelectorRepair', () => ({
  reportSelectorRepair: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => ({ restoreClipboard: vi.fn().mockResolvedValue(true) })
}))

type ScriptResult = Record<string, unknown>

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function makeContent(onScript: (script: string) => Promise<ScriptResult> | undefined) {
  const mocks = {
    focus: vi.fn().mockResolvedValue(undefined),
    paste: vi.fn().mockResolvedValue(true),
    isDestroyed: vi.fn(() => false),
    getURL: vi.fn(() => 'https://chatgpt.com/'),
    executeJavaScript: vi.fn(async (script: string): Promise<ScriptResult> => {
      const gated = onScript(script)
      if (gated) return gated
      return { success: true, action: 'submit_ready', mode: 'mixed', diagnostics: {} }
    })
  }
  return { content: mocks as unknown as AiContentController, mocks }
}

function baseParams(content: AiContentController) {
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
    imageDataUrl: 'data:image/png;base64,AAA',
    effectiveAutoSend: false,
    textInputMode: 'auto' as never,
    typingSpeed: 0,
    requestStartedAt: Date.now(),
    diagnostics: { timings: {} } as never,
    canUseContent: () => true,
    copyImageToClipboard: vi.fn().mockResolvedValue(true),
    generateAutoSendScript: vi.fn().mockResolvedValue('/*prompt*/'),
    generateFocusScript: vi.fn().mockResolvedValue('/*focus*/'),
    generateWaitForSubmitReadyScript: vi.fn().mockResolvedValue('/*ready*/'),
    generateClickSendScript: vi.fn().mockResolvedValue('/*click*/')
  } as unknown as Parameters<typeof executeImageSendPipeline>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolveSendContext.mockResolvedValue({
    aiConfig: { input: 'i', button: 'b', submitMode: 'mixed' },
    currentUrl: 'https://chatgpt.com/'
  })
  mocks.safeContentPaste.mockResolvedValue(true)
})

describe('executeImageSendPipeline — cancellation', () => {
  it('does not paste after the request was cancelled while the focus script ran', async () => {
    const focus = deferred<ScriptResult>()
    const { content } = makeContent((script) =>
      script === '/*focus*/' ? focus.promise : undefined
    )
    const params = baseParams(content)

    const run = executeImageSendPipeline(params)
    await vi.waitFor(() => expect(content.executeJavaScript).toHaveBeenCalledWith('/*focus*/'))

    cancelContentSends(content)
    focus.resolve({ success: true, action: 'focus_done' })
    const result = await run

    expect(content.paste).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
    expect(result.error).toBe('cancelled')
    expect(result.stage).toBe('not_started')
  })
})
