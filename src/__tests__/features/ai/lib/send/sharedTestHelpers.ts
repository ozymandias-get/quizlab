/**
 * Shared test helpers for AI send pipeline tests.
 *
 * Shares content controller mocks, pipeline parameters and timing tolerance
 * across:
 *   - pipelineCancellation.test.ts
 *   - pipelineClassification.test.ts
 *   - pipelineUtils.test.ts
 *   - imageClipboard.test.ts
 *   - imageSendDiagnostics.test.ts
 *   - bulkSendPipeline.test.ts (one directory up)
 */
import type { AiContentController } from '@shared-core/types/aiContent'

import type { PipelineStepParams } from '@features/ai/lib/send/pipelineUtils'
import type { AiSendDiagnostics } from '@features/ai/model/types'

import { RESTORE_SETTLE_MS } from '@features/ai/lib/send/imageClipboard'

import { vi } from 'vitest'

/**
 * Duvar-saati ölçümlerine tolerans.
 *
 * `setTimeout(RESTORE_SETTLE_MS)` ile beklenen süre, `performance.now()`
 * farkı olarak **her zaman** `RESTORE_SETTLE_MS`'ten büyük DEĞİLDİR: libuv'nin
 * döngü saati `performance.now()` ile aynı anı paylaşmaz ve milisaniyenin çok
 * altında sapma oluşabilir. Ölçüldü (40 örnek): `min=699.97`, 2 örnek 700'ün
 * altında; paralel yükte `totalMs=699.63` görüldü. Yani `>= RESTORE_SETTLE_MS`
 * eşiği tanım gereği yanlıştır ve ~%5 olasılıkla kırılır.
 *
 * 100ms'lik pay, gözlenen en kötü sapmanın (~0.4ms) 250 katıdır: ölçümü
 * anlamsızlaştırmadan, restore beklemesinin gerçekten gerçekleştiğini ve
 * toplam süreye dâhil olduğunu kanıtlamaya yeter.
 *
 * Ölçümün ASIL değişmezi sıralamadır (`totalMs >= clipboardRestoreWaitMs` ve
 * `pasteMs < taban`); mutlak eşik yalnızca tabanı destekler.
 */
export const TIMER_TOLERANCE_MS = 100

/**
 * Restore beklemesinin "gerçekten beklenmiş sayılacağı" taban süre.
 * `RESTORE_SETTLE_MS` değişirse bu otomatik olarak onu takip eder.
 */
export const RESTORE_SETTLE_FLOOR_MS = RESTORE_SETTLE_MS - TIMER_TOLERANCE_MS

export function createSendContentMock(
  execResult: unknown = { success: true }
): AiContentController {
  return {
    executeJavaScript: vi.fn().mockResolvedValue(execResult),
    isDestroyed: () => false,
    getURL: () => 'https://chat.example.com'
  }
}

export function makePipelineParams(
  overrides: Partial<PipelineStepParams> = {}
): PipelineStepParams {
  const content = createSendContentMock({ success: true })
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
