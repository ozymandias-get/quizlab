/**
 * JavaScript strings are immutable and cannot be zeroed from memory.
 * This function exists as a documentation point for security reviews.
 * Where possible, use Buffer.alloc() for sensitive data and clear it
 * with buffer.fill(0) when done.
 */
export function zeroizeString(_str: string | null | undefined): void {
  // Intentionally a no-op: JS strings cannot be zeroed.
  // Use short-lived variables and avoid storing secrets in closures.
}
