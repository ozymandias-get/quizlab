/**
 * Strip terminal control characters and escape sequences that could be
 * used in pastejacking attacks.
 */
export function sanitizeClipboardText(raw: string): string {
  let cleaned = raw.replaceAll(/\x1b\[[\d;]*[A-Za-z]/g, '')
  cleaned = cleaned.replaceAll(/\x1b][\d;].*?(?:\x1b\\|\x07)/g, '')
  cleaned = cleaned.replaceAll(/\x1b[\x40-\x5F]/g, '')
  cleaned = cleaned.replaceAll(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return cleaned
}
