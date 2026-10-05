/**
 * Regression coverage for the diagnostic detail behind the generic
 * "Ek görsel hâlâ işleniyor" / "The attachment is still processing" toast.
 *
 * That single message cannot distinguish a genuinely slow upload from a stale
 * selector or a paste that attached nothing, so the pipeline now logs the
 * blocker. These tests pin the log payload and the normalizer that carries it.
 */

import { executeImageSendPipeline } from '@features/ai/lib/send/imageSendPipeline'
import { normalizeExecutionResult } from '@features/ai/lib/send/scriptExecution'
import type { AiSendDiagnostics } from '@features/ai/model/types'

import { Logger } from '@shared/lib/logger'

import type { AiContentController } from '@shared-core/types/aiContent'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

function createContent(): AiContentController {
  return {
    executeJavaScript: vi.fn().mockResolvedValue({ success: true }),
    isDestroyed: () => false,
    getURL: () => 'https://chat.example.com',
    focus: vi.fn(),
    paste: vi.fn().mockReturnValue(true),
    sendInputEvent: vi.fn()
  } as unknown as AiContentController
}

/**
 * Scripts run in generation order; the harness below makes the focus script
 * succeed and the submit_ready script fail with a diagnostic payload.
 */
function baseParams(overrides: Record<string, unknown> = {}) {
  const content = createContent()
  const diagnostics = { currentAI: 'claude', timings: {} } as AiSendDiagnostics
  return {
    contentRef: { current: content } as never,
    content,
    scheduledContent: content,
    aiRegistry: {
      claude: {
        id: 'claude',
        name: 'Claude',
        baseUrl: 'https://claude.ai',
        enabled: true,
        selectors: { input: '#input', button: '#send' }
      }
    } as never,
    currentAI: 'claude',
    queryClient: {} as never,
    configCache: { current: {} } as never,
    activePromptText: null,
    imageDataUrl: PNG,
    effectiveAutoSend: true,
    textInputMode: 'value' as never,
    typingSpeed: 0,
    requestStartedAt: Date.now(),
    diagnostics,
    canUseContent: vi.fn().mockReturnValue(true),
    copyImageToClipboard: vi.fn().mockResolvedValue(true),
    generateAutoSendScript: vi.fn().mockResolvedValue('return true;'),
    generateFocusScript: vi.fn().mockResolvedValue('return true;'),
    generateWaitForSubmitReadyScript: vi.fn(),
    generateClickSendScript: vi.fn().mockResolvedValue('return true;'),
    ...overrides
  }
}

describe('submit-ready failure logging', () => {
  beforeEach(() => {
    vi.spyOn(Logger, 'warn').mockImplementation(() => {})
  })

  it('logs the blocker when the submit target is never interactive', async () => {
    const content = createContent()
    const params = baseParams({
      content,
      contentRef: { current: content },
      scheduledContent: content,
      generateWaitForSubmitReadyScript: vi.fn().mockResolvedValue('return true;')
    })
    // The focus script succeeds, the submit-ready script reports the timeout.
    // A busy mutation count means an upload really was running, so the
    // generic submit_not_ready is the honest outcome.
    content.executeJavaScript = vi.fn().mockResolvedValueOnce({ success: true }).mockResolvedValue({
      success: false,
      action: 'submit_ready',
      error: 'submit_not_ready',
      notReadyTarget: 'button',
      notReadyReason: 'disabled_attribute',
      everReady: false,
      mutationCount: 240,
      waitedMs: 7000,
      budgetMs: 7000,
      minimumWaitMs: 1000
    }) as never

    const result = await executeImageSendPipeline(params as never)

    expect(result.success).toBe(false)
    expect(result.error).toBe('submit_not_ready')

    const warnCalls = (Logger.warn as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(warnCalls.length).toBeGreaterThan(0)
    const [tag, payload] = warnCalls[0] as [string, string]
    expect(tag).toContain('submit-ready')
    expect(JSON.parse(payload)).toMatchObject({
      platform: 'claude',
      errorCode: 'submit_not_ready',
      notReadyTarget: 'button',
      notReadyReason: 'disabled_attribute',
      everReady: false,
      mutationCount: 240,
      budgetMs: 7000
    })
  })

  it('logs nothing extra for a failed step with no diagnostic payload', async () => {
    const content = createContent()
    content.executeJavaScript = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValue({ success: false, action: 'submit_ready', error: 'submit_not_ready' })

    const params = baseParams({
      content,
      contentRef: { current: content },
      scheduledContent: content,
      generateWaitForSubmitReadyScript: vi.fn().mockResolvedValue('return true;')
    })

    await executeImageSendPipeline(params as never)

    const warnCalls = (Logger.warn as unknown as ReturnType<typeof vi.fn>).mock.calls
    const payload = JSON.parse((warnCalls[0] as [string, string])[1])
    // Unknown, not invented: the pipeline must not fabricate a reason.
    expect(payload.notReadyReason).toBeUndefined()
    expect(payload.errorCode).toBe('submit_not_ready')
  })

  // The generic "still processing" message tells the user to wait, which can
  // never help when the page never received the paste in the first place.
  it('reports paste_not_applied when the page never changed after the paste', async () => {
    const content = createContent()
    content.executeJavaScript = vi.fn().mockResolvedValueOnce({ success: true }).mockResolvedValue({
      success: false,
      action: 'submit_ready',
      error: 'submit_not_ready',
      notReadyTarget: 'button',
      notReadyReason: 'aria_disabled',
      everReady: false,
      mutationCount: 0
    }) as never

    const params = baseParams({
      content,
      contentRef: { current: content },
      scheduledContent: content,
      generateWaitForSubmitReadyScript: vi.fn().mockResolvedValue('return true;')
    })

    const result = await executeImageSendPipeline(params as never)

    expect(result.success).toBe(false)
    expect(result.error).toBe('paste_not_applied')
  })

  it('keeps submit_not_ready when the page was actively changing', async () => {
    const content = createContent()
    // Many mutations mean an upload really was in progress; waiting is right.
    content.executeJavaScript = vi.fn().mockResolvedValueOnce({ success: true }).mockResolvedValue({
      success: false,
      action: 'submit_ready',
      error: 'submit_not_ready',
      everReady: false,
      mutationCount: 180
    }) as never

    const params = baseParams({
      content,
      contentRef: { current: content },
      scheduledContent: content,
      generateWaitForSubmitReadyScript: vi.fn().mockResolvedValue('return true;')
    })

    const result = await executeImageSendPipeline(params as never)

    expect(result.error).toBe('submit_not_ready')
  })

  it('keeps submit_not_ready when the target was briefly enabled', async () => {
    const content = createContent()
    // everReady means the site did react; the button then re-disabled, which is
    // a different problem from a paste that never landed.
    content.executeJavaScript = vi.fn().mockResolvedValueOnce({ success: true }).mockResolvedValue({
      success: false,
      action: 'submit_ready',
      error: 'submit_not_ready',
      everReady: true,
      mutationCount: 0
    }) as never

    const params = baseParams({
      content,
      contentRef: { current: content },
      scheduledContent: content,
      generateWaitForSubmitReadyScript: vi.fn().mockResolvedValue('return true;')
    })

    const result = await executeImageSendPipeline(params as never)

    expect(result.error).toBe('submit_not_ready')
  })
})

describe('normalizeExecutionResult', () => {
  it('preserves the submit-ready diagnostic fields', () => {
    const result = normalizeExecutionResult({
      success: false,
      error: 'submit_not_ready',
      notReadyTarget: 'input',
      notReadyReason: 'zero_size',
      waitedMs: 7000,
      budgetMs: 7000,
      minimumWaitMs: 1000,
      everReady: false,
      mutationCount: 0,
      sinceLastMutationMs: 6500,
      checkIterations: 12
    })

    expect(result).toMatchObject({
      success: false,
      error: 'submit_not_ready',
      notReadyTarget: 'input',
      notReadyReason: 'zero_size',
      waitedMs: 7000,
      budgetMs: 7000,
      minimumWaitMs: 1000,
      everReady: false,
      mutationCount: 0,
      sinceLastMutationMs: 6500,
      checkIterations: 12
    })
  })

  it('leaves the fields undefined for a plain boolean result', () => {
    const result = normalizeExecutionResult(true)
    expect(result).toEqual({ success: true })
  })
})
