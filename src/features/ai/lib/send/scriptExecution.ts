import type { AutomationExecutionDiagnostics, AutomationExecutionResult } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import { ensureErrorMessage } from '@shared/lib/errorUtils'

const DESTROYED_CONTENT_PATTERNS = [
  /webcontents was destroyed/i,
  /object has been destroyed/i,
  /attempting to call a function in a destroyed renderer/i,
  /content frame has been disposed/i,
  /frame has been disposed/i
]

/**
 * Detects Electron's "guest content was torn down" rejections. These fire when
 * a tab is closed or the AI provider is swapped while a script is still
 * executing, and must be treated as an expected lifecycle race instead of a
 * pipeline crash.
 */
export function isContentDestroyedError(error: unknown): boolean {
  if (!error) return false
  const message = ensureErrorMessage(error, '')
  return DESTROYED_CONTENT_PATTERNS.some((pattern) => pattern.test(message))
}

export type ExecuteContentScriptResult =
  | { ok: true; value: unknown }
  | { ok: false; destroyed: boolean; error: unknown }

/**
 * Safe wrapper around `content.executeJavaScript`. Converts the raw rejection
 * (e.g. `Error: WebContents was destroyed`) into a discriminated result so
 * callers never let a lifecycle race escape the promise chain as an unhandled
 * rejection.
 */
export async function executeContentScript(
  content: AiContentController,
  script: string
): Promise<ExecuteContentScriptResult> {
  try {
    const value = await content.executeJavaScript(script)
    if (value === undefined && content.isDestroyed?.() === true) {
      return {
        ok: false,
        destroyed: true,
        error: new Error('Content was destroyed before script execution')
      }
    }
    return { ok: true, value }
  } catch (error: unknown) {
    return { ok: false, destroyed: isContentDestroyedError(error), error }
  }
}

export function normalizeExecutionResult(value: unknown): AutomationExecutionResult | null {
  if (typeof value === 'boolean') {
    return { success: value }
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<AutomationExecutionResult>
  return {
    success: typeof candidate.success === 'boolean' ? candidate.success : !candidate.error,
    error: candidate.error,
    mode: candidate.mode,
    action: candidate.action,
    notReadyReason: candidate.notReadyReason,
    notReadyTarget: candidate.notReadyTarget,
    waitedMs: candidate.waitedMs,
    budgetMs: candidate.budgetMs,
    minimumWaitMs: candidate.minimumWaitMs,
    everReady: candidate.everReady,
    mutationCount: candidate.mutationCount,
    sinceLastMutationMs: candidate.sinceLastMutationMs,
    checkIterations: candidate.checkIterations,
    diagnostics: candidate.diagnostics
  }
}

export function cloneScriptDiagnostics(
  diagnostics?: AutomationExecutionDiagnostics | null
): AutomationExecutionDiagnostics | null {
  return diagnostics
    ? (JSON.parse(JSON.stringify(diagnostics)) as AutomationExecutionDiagnostics)
    : null
}
