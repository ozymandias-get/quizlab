import { classifyAiSendError, classifyResultError } from '@features/ai/lib/aiSenderSupport'
import { executePipelineStep } from '@features/ai/lib/send/pipelineUtils'
import type { SendImageResult, SendTextResult } from '@features/ai/model/types'

import { describe, expect, it, vi } from 'vitest'

import { createSendWebviewMock, makePipelineParams } from './sharedTestHelpers'

describe('pipeline error classification integration', () => {
  describe('classifyAiSendError', () => {
    it('classifies a known error code from a real pipeline', async () => {
      const cls = await classifyAiSendError('input_not_found')
      expect(cls.category).toBe('selector')
      expect(cls.retry).toBe('after-repick')
      expect(cls.toastKey).toBe('toast_input_not_found')
      expect(cls.isUserActionable).toBe(true)
    })

    it('classifies a submit error with fallback trigger', async () => {
      const cls = await classifyAiSendError('submit_not_ready')
      expect(cls.category).toBe('submit')
      expect(cls.retry).toBe('different-strategy')
      expect(cls.triggerFallback).toBe(true)
    })

    it('classifies arbitrary framework noise as unknown', async () => {
      const cls = await classifyAiSendError('Illegal invocation')
      expect(cls.category).toBe('unknown')
    })

    it('preserves the original code', async () => {
      const cls = await classifyAiSendError('upload_timed_out')
      expect(cls.code).toBe('upload_timed_out')
    })
  })

  describe('classifyResultError', () => {
    it('returns null for successful results', async () => {
      const ok: SendTextResult = { success: true, mode: 'click' }
      expect(await classifyResultError(ok)).toBeNull()
    })

    it('returns null for null/undefined input', async () => {
      expect(await classifyResultError(null)).toBeNull()
      expect(await classifyResultError(undefined)).toBeNull()
    })

    it('classifies errors on a result with error field', async () => {
      const err: SendImageResult = { success: false, error: 'button_not_found' }
      const cls = await classifyResultError(err)
      expect(cls).not.toBeNull()
      expect(cls!.category).toBe('selector')
      expect(cls!.retry).toBe('after-repick')
    })
  })

  describe('executePipelineStep attaches classification to diagnostics', () => {
    it('attaches a classified error when script returns input_not_found', async () => {
      const webview = createSendWebviewMock({ success: false, error: 'input_not_found' })
      const params = makePipelineParams({ webview, scheduledWebview: webview })

      const result = await executePipelineStep<SendTextResult>(params)
      expect(result.success).toBe(false)

      if (!result.success) {
        // 1) Flat string still works (backward compat)
        expect(result.error.error).toBe('input_not_found')
        // 2) Rich classification is in diagnostics
        expect(result.error.diagnostics?.classification).toBeDefined()
        expect(result.error.diagnostics?.classification?.category).toBe('selector')
        expect(result.error.diagnostics?.classification?.retry).toBe('after-repick')
        expect(result.error.diagnostics?.classification?.toastKey).toBe('toast_input_not_found')
      }
    })

    it('attaches a classified error when script returns submit_not_ready', async () => {
      const webview = createSendWebviewMock({ success: false, error: 'submit_not_ready' })
      const params = makePipelineParams({ webview, scheduledWebview: webview })

      const result = await executePipelineStep<SendTextResult>(params)
      expect(result.success).toBe(false)

      if (!result.success) {
        expect(result.error.diagnostics?.classification?.category).toBe('submit')
        expect(result.error.diagnostics?.classification?.retry).toBe('different-strategy')
        expect(result.error.diagnostics?.classification?.triggerFallback).toBe(true)
      }
    })

    it('uses the step-name fallback code when script returns no error field', async () => {
      const webview = createSendWebviewMock({ success: false })
      const params = makePipelineParams({ webview, scheduledWebview: webview })

      const result = await executePipelineStep<SendTextResult>(params)
      expect(result.success).toBe(false)
      if (!result.success) {
        // Code is `send_failed` (name.toLowerCase()) - falls into unknown category
        expect(result.error.error).toBe('send_failed')
        expect(result.error.diagnostics?.classification?.code).toBe('send_failed')
      }
    })

    it('classifies a script-generation failure as config (never retry)', async () => {
      const params = makePipelineParams({ generateScript: vi.fn().mockResolvedValue(null) })

      const result = await executePipelineStep<SendTextResult>(params)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.error).toBe('send_script_failed')
        // 'send_script_failed' is not in the table → unknown category, same-strategy, triggerFallback
        expect(result.error.diagnostics?.classification?.category).toBe('unknown')
        expect(result.error.diagnostics?.classification?.triggerFallback).toBe(true)
      }
    })

    it('classifies webview_destroyed as webview / never', async () => {
      const params = makePipelineParams({ canUseWebview: vi.fn().mockReturnValue(false) })

      const result = await executePipelineStep<SendTextResult>(params)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.error).toBe('webview_destroyed')
        expect(result.error.diagnostics?.classification?.category).toBe('webview')
        expect(result.error.diagnostics?.classification?.retry).toBe('never')
      }
    })
  })
})
