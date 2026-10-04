/**
 * Shared test helpers for AI send pipeline tests.
 *
 * Extracts the duplicate createWebviewMock and makeParams from:
 *   - pipelineCancellation.test.ts
 *   - pipelineClassification.test.ts
 *   - pipelineUtils.test.ts
 */
import type { AiContentController } from '@shared-core/types/aiContent'

import type { PipelineStepParams } from '@features/ai/lib/send/pipelineUtils'
import type { AiSendDiagnostics } from '@features/ai/model/types'

import { vi } from 'vitest'

export function createSendWebviewMock(
  execResult: unknown = { success: true }
): AiContentController {
  return {
    executeJavaScript: vi.fn().mockResolvedValue(execResult),
    isDestroyed: () => false,
    getURL: () => 'https://chat.example.com',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as AiContentController
}

export function makePipelineParams(
  overrides: Partial<PipelineStepParams> = {}
): PipelineStepParams {
  const content = createSendWebviewMock({ success: true })
  return {
    name: 'Send',
    content,
    scheduledContent: content,
    diagnostics: {
      currentAI: 'claude',
      timings: {}
    } as AiSendDiagnostics,
    requestStartedAt: Date.now(),
    canUseContent: vi.fn().mockReturnValue(true),
    generateScript: vi.fn().mockResolvedValue('return true;'),
    onTiming: vi.fn(),
    onExecuteTiming: vi.fn(),
    onResult: vi.fn(),
    ...overrides
  }
}
