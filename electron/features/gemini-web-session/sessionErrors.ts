import { reportSuppressedError } from '../../core/logger.js'

export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

/**
 * Feature-local adapter for the centralized `reportSuppressedError` shim.
 *
 * Kept as a thin wrapper so the ~20 call sites in this feature don't have to
 * change their call shape (`logSuppressedError('context', error)` reads more
 * naturally than `reportSuppressedError('context', { cause: error })`).
 *
 * The `error` argument is normalised through `toErrorMessage` so non-Error
 * inputs always produce a stable, human-readable string in the buffer (and in
 * any future crash dump). Errors go to the in-memory log buffer instead of
 * being lost, matching the renderer's `reportSuppressedError` behaviour.
 */
export function logSuppressedError(context: string, error: unknown): void {
  reportSuppressedError(`geminiWebSession.${context}`, {
    cause: toErrorMessage(error, 'unknown_error')
  })
}
