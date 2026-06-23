import {
  cancelWebviewSends,
  getOrCreateCancelFlag,
  isWebviewCancelled
} from '@features/ai/lib/aiSenderSupport'
import { executePipelineStep } from '@features/ai/lib/send/pipelineUtils'
import type { SendTextResult } from '@features/ai/model/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSendWebviewMock, makePipelineParams } from './sharedTestHelpers'

describe('per-webview cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('cancel flag utilities', () => {
    it('isWebviewCancelled returns false for fresh webview', () => {
      const wv = createSendWebviewMock({ success: true })
      expect(isWebviewCancelled(wv)).toBe(false)
    })

    it('cancelWebviewSends sets the flag for the given webview', () => {
      const wv = createSendWebviewMock({ success: true })
      cancelWebviewSends(wv)
      expect(isWebviewCancelled(wv)).toBe(true)
    })

    it('cancellation is per-webview (does not affect others)', () => {
      const wv1 = createSendWebviewMock({ success: true })
      const wv2 = createSendWebviewMock({ success: true })
      cancelWebviewSends(wv1)
      expect(isWebviewCancelled(wv1)).toBe(true)
      expect(isWebviewCancelled(wv2)).toBe(false)
    })

    it('getOrCreateCancelFlag reuses the same flag object across calls', () => {
      const wv = createSendWebviewMock({ success: true })
      const flag1 = getOrCreateCancelFlag(wv)
      const flag2 = getOrCreateCancelFlag(wv)
      expect(flag1).toBe(flag2)
      flag1.cancelled = true
      expect(getOrCreateCancelFlag(wv).cancelled).toBe(true)
    })
  })

  describe('executePipelineStep respects cancellation', () => {
    it('returns cancelled error before executing script when flag is set', async () => {
      const webview = createSendWebviewMock({ success: true })
      cancelWebviewSends(webview)

      const params = makePipelineParams({ webview, scheduledWebview: webview })
      const result = await executePipelineStep<SendTextResult>(params)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.error).toBe('cancelled')
        expect(result.error.diagnostics?.classification?.category).toBe('unknown')
        expect(result.error.diagnostics?.classification?.retry).toBe('never')
      }
      // Script should never have been called
      expect(webview.executeJavaScript).not.toHaveBeenCalled()
    })

    it('runs script normally when no cancellation flag is set', async () => {
      const webview = createSendWebviewMock({ success: true })
      const params = makePipelineParams({ webview, scheduledWebview: webview })
      const result = await executePipelineStep<SendTextResult>(params)

      expect(result.success).toBe(true)
      expect(webview.executeJavaScript).toHaveBeenCalledTimes(1)
    })

    it('newest request wins - resetting flag allows execution', async () => {
      const webview = createSendWebviewMock({ success: true })
      const flag = getOrCreateCancelFlag(webview)
      flag.cancelled = true
      expect(isWebviewCancelled(webview)).toBe(true)

      // Caller resets for their own request
      flag.cancelled = false
      expect(isWebviewCancelled(webview)).toBe(false)

      const params = makePipelineParams({ webview, scheduledWebview: webview })
      const result = await executePipelineStep<SendTextResult>(params)
      expect(result.success).toBe(true)
    })
  })
})
