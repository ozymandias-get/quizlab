/**
 * Which URLs the app is willing to hand to the operating system.
 *
 * `shell.openExternal` is a one-way door: whatever it accepts, the OS will open
 * with the user's default handler. The renderer is therefore not trusted to
 * have filtered the URL, and every rejection rule lives here as a pure decision
 * so it can be unit-tested without booting Electron.
 *
 * Rules, in order:
 *   1. no control characters, no protocol-relative `//host` (inherits our scheme)
 *   2. no embedded credentials
 *   3. only `https:` and `mailto:`
 *   4. `https:` must name a real public-looking host — a bare IPv4 literal, a
 *      loopback name or a TLD-less host is refused, because those are the shapes
 *      a redirect to a local service arrives in.
 */

const FORBIDDEN_PATTERN = /[\x00-\x1f\x7f-\x9f]/
const IPV4_LITERAL = /^(?:\d{1,3}\.){3}\d{1,3}$/
const ALLOWED_PROTOCOLS = ['https:', 'mailto:'] as const

/**
 * `rejected` is an ordinary policy denial and is silent. `unparsable` means the
 * URL constructor itself refused the string; the caller reports that as an
 * error, because it is a caller bug rather than a hostile input.
 */
export type ExternalLinkDecision =
  | { allowed: true; url: string }
  | { allowed: false; reason: 'rejected' | 'unparsable'; parseError?: string }

const REJECTED: ExternalLinkDecision = { allowed: false, reason: 'rejected' }

export function resolveExternalLink(rawUrl: unknown): ExternalLinkDecision {
  if (!rawUrl || typeof rawUrl !== 'string') return REJECTED

  if (FORBIDDEN_PATTERN.test(rawUrl)) return REJECTED
  if (rawUrl.startsWith('//')) return REJECTED

  if (!rawUrl.startsWith('mailto:')) {
    try {
      const parsedForCredCheck = new URL(rawUrl)
      if (parsedForCredCheck.username || parsedForCredCheck.password) return REJECTED
    } catch {
      if (rawUrl.includes('@')) return REJECTED
    }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch (error) {
    return {
      allowed: false,
      reason: 'unparsable',
      parseError: error instanceof Error ? error.message : String(error)
    }
  }

  if (!(ALLOWED_PROTOCOLS as readonly string[]).includes(parsedUrl.protocol)) return REJECTED

  // The parsed protocol is authoritative for `HTTP:`-style casing; the raw prefix
  // check additionally refuses anything the parser was lenient about.
  const rawProtocolMatch = ALLOWED_PROTOCOLS.some((protocol) => rawUrl.startsWith(protocol))
  if (!rawProtocolMatch) return REJECTED

  if (parsedUrl.protocol === 'https:') {
    const host = parsedUrl.hostname.toLowerCase()
    if (IPV4_LITERAL.test(host)) return REJECTED
    // URL.hostname keeps brackets for IPv6 literals ("[::1]").
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
      return REJECTED
    }
    if (!host.includes('.')) return REJECTED
  }

  return { allowed: true, url: parsedUrl.toString() }
}
