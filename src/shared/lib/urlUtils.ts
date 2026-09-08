/**
 * Single source of truth for URL parsing and protocol allow-listing.
 * Security-relevant: every user/remote supplied URL must pass through one of
 * these helpers before being opened or rendered.
 */

const HTTP_PROTOCOLS: readonly string[] = ['http:', 'https:']

export type UrlValidationResult = 'ok' | 'invalid_format' | 'protocol_not_allowed'

/** Parses `rawUrl` and returns it only when its protocol is allow-listed. */
export function parseUrlWithAllowedProtocols(
  rawUrl: string,
  allowedProtocols: readonly string[]
): URL | null {
  if (typeof rawUrl !== 'string') return null
  // Defense in depth: WHATWG URL strips ASCII tab/LF/CR before parsing, so
  // "jav\tascript:..." would otherwise normalize to "javascript:..." and rely
  // solely on the protocol check below. Reject any control/whitespace inside
  // the scheme portion explicitly so obfuscated schemes never get that far.
  const trimmed = rawUrl.trim()
  if (trimmed.length === 0 || trimmed.length > 8192) return null

  if (/[\u0000-\u0020\u007f-\u00a0\u2000-\u200b\u2028\u2029]/.test(trimmed.split(':')[0])) {
    return null
  }
  try {
    const parsed = new URL(trimmed)
    if (!allowedProtocols.includes(parsed.protocol)) return null
    return parsed
  } catch {
    return null
  }
}

/** Parses an HTTP(S) URL; returns null for malformed or non-HTTP(S) input. */
export function parseHttpUrl(rawUrl: string): URL | null {
  return parseUrlWithAllowedProtocols(rawUrl, HTTP_PROTOCOLS)
}

/**
 * Classifies a URL for form validation without throwing.
 * - `'ok'` — well-formed and HTTP(S)
 * - `'protocol_not_allowed'` — well-formed but not HTTP(S)
 * - `'invalid_format'` — not parseable as a URL at all
 */
export function validateHttpUrl(
  rawUrl: string,
  allowedProtocols: readonly string[] = HTTP_PROTOCOLS
): UrlValidationResult {
  try {
    const parsed = new URL(rawUrl.trim())
    if (!allowedProtocols.includes(parsed.protocol)) return 'protocol_not_allowed'
    return 'ok'
  } catch {
    return 'invalid_format'
  }
}
