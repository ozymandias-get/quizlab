/**
 * Standardizes error conversion from unknown catch variables.
 * Ensures we always have a string message and can optionally narrow to Error objects.
 */

/**
 * Safely extracts a message from any value thrown in a catch block.
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

/**
 * Narrows an unknown value to an Error object if possible, otherwise creates a new one.
 */
export function narrowError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(ensureErrorMessage(error))
}
