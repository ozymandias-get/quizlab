/**
 * Single source of truth for URL parsing and protocol allow-listing.
 * Security-relevant: every user/remote supplied URL must pass through one of
 * these helpers before being opened or rendered.
 */

export const HTTP_PROTOCOLS: readonly string[] = ['http:', 'https:']

export type UrlValidationResult = 'ok' | 'invalid_format' | 'protocol_not_allowed'

/** Parses `rawUrl` and returns it only when its protocol is allow-listed. */
export function parseUrlWithAllowedProtocols(
  rawUrl: string,
  allowedProtocols: readonly string[]
): URL | null {
  try {
    const parsed = new URL(rawUrl.trim())
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

export function isValidHttpUrl(url: string): boolean {
  return parseHttpUrl(url) !== null
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
