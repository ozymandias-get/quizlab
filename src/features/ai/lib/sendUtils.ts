/**
 * Lightweight send utilities — no heavy dependencies.
 * Extracted from aiSenderSupport.ts to avoid pulling errorClassifier
 * and electron-specific code into the main chunk.
 */

/**
 * Resolves the effective auto-send flag for a single send request.
 *
 * The per-call `autoSend` option wins; otherwise the user's global auto-send
 * preference applies. There is deliberately no "force" escape hatch: when the
 * user turns auto-send off they want to review before anything is submitted,
 * and every composer affordance (Send button, prompt presets, Enter in the note
 * field) must honour that. Anything that submits regardless would silently
 * override a setting the user deliberately turned off.
 */
export function resolveAutoSend(
  defaultAutoSend: boolean,
  options?: { autoSend?: boolean }
): boolean {
  if (options && options.autoSend !== undefined) return options.autoSend
  return defaultAutoSend
}

/**
 * Send outcomes that mean the content was accepted but is still waiting for the
 * user to submit it.
 *
 * With auto-send off the pipeline only stages the turn: the image is pasted into
 * the site's composer and the prompt is typed, but submitting stays the user's
 * action. Those outcomes are still `success: true`, so callers must consult the
 * mode before claiming a delivery.
 *
 * This is an allowlist of *staged* outcomes rather than of delivered ones on
 * purpose: successful text sends report a wide range of `submitMode` values
 * (`click`, `enter_key`, `mixed`, …) and new ones appear as platforms evolve.
 * Treating "not staged" as delivered cannot mislabel a real delivery.
 */
const STAGED_MODES = new Set(['staged', 'paste_only', 'paste_and_prompt'])

/**
 * True when the content was accepted but is waiting for the user to submit it.
 */
export function isStagedSendResult(result: { success: boolean; mode?: string }): boolean {
  return result.success && typeof result.mode === 'string' && STAGED_MODES.has(result.mode)
}

/**
 * True only when the turn reached the model.
 */
export function isDeliveredSendResult(result: { success: boolean; mode?: string }): boolean {
  return result.success && !isStagedSendResult(result)
}

/**
 * Maps browser/runtime messages to stable error codes.
 */
export function normalizeSendErrorCode(raw: unknown, fallback: string): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || trimmed === 'Illegal invocation') return fallback
    return trimmed
  }
  if (typeof raw === 'number') return String(raw)
  return fallback
}
