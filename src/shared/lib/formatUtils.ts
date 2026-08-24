/**
 * Shared formatting helpers for human-readable values.
 */

/** Formats a byte count as a readable string (`B`, `KB`, `MB`). */
export function formatBytes(bytes: number): string {
  const safe = Math.max(0, bytes)
  if (safe < 1024) return `${safe} B`
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(1)} KB`
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`
}
