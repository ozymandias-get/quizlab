/**
 * Why a submit-ready wait gave up.
 *
 * The user-visible error is a single generic "still processing" string, so
 * without this the only way to tell a genuinely slow upload from a stale
 * selector or a failed paste is to reproduce it by hand. One case deserves its
 * own answer rather than a log line: a composer that never changed at all means
 * the paste never arrived, and waiting cannot help.
 */
import type { AutomationExecutionResult } from '@shared-core/types'

import { Logger, reportSuppressedError } from '@shared/lib/logger'

import type { AiSendDiagnostics } from '../../model/types'

/**
 * Zero DOM mutations *and* a target that was never interactive: the paste never
 * reached the page at all.
 */
export function isPasteIgnoredByPage(
  scriptResult: AutomationExecutionResult | null | undefined
): boolean {
  return scriptResult?.everReady === false && (scriptResult?.mutationCount ?? 0) === 0
}

export function reportSubmitReadyFailure(params: {
  step: { error?: unknown; scriptResult?: AutomationExecutionResult | null }
  platformId: string
  currentUrl: string
  minimumReadyWaitMs: number
  submitReadyTimeoutMs: number
  clipboardRestored: boolean
  pasteIgnoredPage: boolean
  diagnostics: AiSendDiagnostics
}): void {
  const { step, currentUrl, diagnostics } = params
  const result = step.scriptResult
  const failure = step.error as { error?: string } | undefined

  const detail = {
    platform: params.platformId,
    url: currentUrl,
    errorCode: failure?.error ?? result?.error ?? 'unknown',
    notReadyTarget: result?.notReadyTarget,
    notReadyReason: result?.notReadyReason,
    // never-ready + no DOM movement == the paste attached nothing
    everReady: result?.everReady,
    mutationCount: result?.mutationCount,
    checkIterations: result?.checkIterations,
    waitedMs: result?.waitedMs ?? diagnostics.timings.imageUploadWaitMs,
    budgetMs: result?.budgetMs ?? params.submitReadyTimeoutMs,
    platformMinWaitMs: params.minimumReadyWaitMs,
    clipboardRestored: params.clipboardRestored,
    pasteIgnoredPage: params.pasteIgnoredPage,
    pasteMs: diagnostics.timings.pasteMs,
    clipboardMs: diagnostics.timings.clipboardMs,
    submitReadyExecuteMs: diagnostics.timings.submitReadyExecuteJavaScriptMs
  }

  // `submit_not_ready` means the element was found but stayed un-interactive.
  // Surface it as a warning so it is not lost in the noise of info logs.
  Logger.warn('[imageSend] submit-ready gave up', JSON.stringify(detail))
  reportSuppressedError('imageSend.submitNotReady', { cause: new Error(JSON.stringify(detail)) })
}
