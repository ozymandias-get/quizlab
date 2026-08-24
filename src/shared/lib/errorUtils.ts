/**
 * Standardizes error conversion from unknown catch variables.
 * Ensures we always have a string message.
 */

export function ensureErrorMessage(error: unknown, fallback: string = 'Unknown error'): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    // JSON.stringify returns `undefined` (not a throw) for undefined /
    // functions / symbols, so guard the result explicitly.
    const serialized = JSON.stringify(error)
    if (serialized !== undefined && serialized !== null) return serialized
  } catch {
    // Circular or otherwise non-serializable value — use the fallback below.
  }
  return fallback
}
