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
