/**
 * Standardizes error conversion from unknown catch variables.
 * Ensures we always have a string message.
 */

export function ensureErrorMessage(error: unknown, fallback: string = 'Unknown error'): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return fallback
  }
}
