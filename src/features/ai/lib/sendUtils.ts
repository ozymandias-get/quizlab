/**
 * Lightweight send utilities — no heavy dependencies.
 * Extracted from aiSenderSupport.ts to avoid pulling errorClassifier
 * and electron-specific code into the main chunk.
 */

/**
 * Resolves the effective auto-send flag for a single send request.
 * `forceAutoSend` always wins (e.g. user-clicked "Send" with auto-send disabled),
 * otherwise the per-call `autoSend` option is preferred, falling back to the
 * global `autoSend` preference.
 */
export function resolveAutoSend(
  defaultAutoSend: boolean,
  options?: { autoSend?: boolean; forceAutoSend?: boolean }
): boolean {
  if (options?.forceAutoSend === true) return true
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
