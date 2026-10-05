import {
  cancelContentSends,
  getOrCreateCancelFlag,
  isContentCancelled
} from '@features/ai/lib/aiSenderSupport'
import { executePipelineStep } from '@features/ai/lib/send/pipelineUtils'
import type { SendTextResult } from '@features/ai/model/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSendContentMock, makePipelineParams } from './sharedTestHelpers'

describe('per-content cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('cancel flag utilities', () => {
    it('isContentCancelled returns false for fresh content', () => {
      const wv = createSendContentMock({ success: true })
      expect(isContentCancelled(wv)).toBe(false)
    })

    it('cancelContentSends sets the flag for the given content', () => {
      const wv = createSendContentMock({ success: true })
      cancelContentSends(wv)
      expect(isContentCancelled(wv)).toBe(true)
    })

    it('cancellation is per-content (does not affect others)', () => {
      const wv1 = createSendContentMock({ success: true })
      const wv2 = createSendContentMock({ success: true })
      cancelContentSends(wv1)
      expect(isContentCancelled(wv1)).toBe(true)
      expect(isContentCancelled(wv2)).toBe(false)
    })

    it('getOrCreateCancelFlag reuses the same flag object across calls', () => {
      const wv = createSendContentMock({ success: true })
      const flag1 = getOrCreateCancelFlag(wv)
      const flag2 = getOrCreateCancelFlag(wv)
      expect(flag1).toBe(flag2)
      flag1.cancelled = true
      expect(getOrCreateCancelFlag(wv).cancelled).toBe(true)
    })
  })

  describe('executePipelineStep respects cancellation', () => {
    it('returns cancelled error before executing script when flag is set', async () => {
      const content = createSendContentMock({ success: true })
      cancelContentSends(content)

      const params = makePipelineParams({ content, scheduledContent: content })
      const result = await executePipelineStep<SendTextResult>(params)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.error).toBe('cancelled')
        expect(result.error.diagnostics?.classification?.category).toBe('unknown')
        expect(result.error.diagnostics?.classification?.retry).toBe('never')
      }
      // Script should never have been called
      expect(content.executeJavaScript).not.toHaveBeenCalled()
    })

    it('runs script normally when no cancellation flag is set', async () => {
      const content = createSendContentMock({ success: true })
      const params = makePipelineParams({ content, scheduledContent: content })
      const result = await executePipelineStep<SendTextResult>(params)

      expect(result.success).toBe(true)
      expect(content.executeJavaScript).toHaveBeenCalledTimes(1)
    })

    it('newest request wins - resetting flag allows execution', async () => {
      const content = createSendContentMock({ success: true })
      const flag = getOrCreateCancelFlag(content)
      flag.cancelled = true
      expect(isContentCancelled(content)).toBe(true)

      // Caller resets for their own request
      flag.cancelled = false
      expect(isContentCancelled(content)).toBe(false)

      const params = makePipelineParams({ content, scheduledContent: content })
      const result = await executePipelineStep<SendTextResult>(params)
      expect(result.success).toBe(true)
    })
  })
})
