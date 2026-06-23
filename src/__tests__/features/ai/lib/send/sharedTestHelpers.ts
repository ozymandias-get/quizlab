/**
 * Shared test helpers for AI send pipeline tests.
 *
 * Extracts the duplicate createWebviewMock and makeParams from:
 *   - pipelineCancellation.test.ts
 *   - pipelineClassification.test.ts
 *   - pipelineUtils.test.ts
 */
import type { WebviewController } from '@shared-core/types/webview'

import type { PipelineStepParams } from '@features/ai/lib/send/pipelineUtils'
import type { AiSendDiagnostics } from '@features/ai/model/types'

import { vi } from 'vitest'

export function createSendWebviewMock(execResult: unknown = { success: true }): WebviewController {
  return {
    executeJavaScript: vi.fn().mockResolvedValue(execResult),
    isDestroyed: () => false,
    getURL: () => 'https://chat.example.com',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as WebviewController
}

export function makePipelineParams(
  overrides: Partial<PipelineStepParams> = {}
): PipelineStepParams {
  const webview = createSendWebviewMock({ success: true })
  return {
    name: 'Send',
    webview,
    scheduledWebview: webview,
    diagnostics: {
      currentAI: 'claude',
      timings: {}
    } as AiSendDiagnostics,
    requestStartedAt: Date.now(),
    canUseWebview: vi.fn().mockReturnValue(true),
    generateScript: vi.fn().mockResolvedValue('return true;'),
    onTiming: vi.fn(),
    onExecuteTiming: vi.fn(),
    onResult: vi.fn(),
    ...overrides
  }
}
