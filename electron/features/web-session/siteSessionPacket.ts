/**
 * The wire format of the site-session bridge.
 *
 * The extension sends a JSON packet; the importer wants a cookie of its own
 * shape. Both translations live here, at the boundary, so the bridge core does
 * not have to carry the wire vocabulary and neither side has to know the
 * other's spelling.
 */

import type { ChromeExtensionCookie } from '@shared-core/types'

import type { CookiePacket, CookiePacketStatus } from './siteSessionCookieRouter.js'
import type { ExternalBrowserCookie } from './siteSessionImporter.js'

/**
 * The wire vocabulary of the extension and the one of the importer differ.
 *
 * Chrome names the SameSite attribute in lower case (`no_restriction`), the
 * importer names it the way Electron does (`None`). A cookie that arrives
 * with an unknown attribute keeps its default instead of silently changing
 * meaning.
 */
const SAME_SITE_FROM_CHROME: Record<string, ExternalBrowserCookie['sameSite']> = {
  strict: 'Strict',
  lax: 'Lax',
  no_restriction: 'None',
  unspecified: 'Unspecified'
}

/** The importer's shape of a cookie the extension sent. */
export function toImporterCookie(cookie: ChromeExtensionCookie): ExternalBrowserCookie {
  const sameSite = cookie.sameSite ? SAME_SITE_FROM_CHROME[cookie.sameSite] : undefined
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    sameSite,
    expires: cookie.expires
  }
}

const COOKIE_PACKET_STATUSES: ReadonlySet<string> = new Set([
  'ok',
  'no_cookies',
  'permission_missing'
])

/** The SameSite values Chrome reports. */
const SAME_SITE_VALUES: ReadonlySet<string> = new Set([
  'strict',
  'lax',
  'no_restriction',
  'unspecified'
])

/** A cookie of the shape the extension sends. */
function isBrowserCookie(value: unknown): value is ChromeExtensionCookie {
  if (typeof value !== 'object' || value === null) return false
  const cookie = value as Partial<ChromeExtensionCookie>
  if (typeof cookie.name !== 'string' || typeof cookie.value !== 'string') return false
  if (cookie.sameSite !== undefined && !SAME_SITE_VALUES.has(cookie.sameSite)) return false
  return true
}

/**
 * Reads a cookie packet out of an untrusted body.
 *
 * Every field is checked before it reaches the rest of the app: a packet has
 * to name exactly one site and carry a status the app knows. A packet that
 * does not is refused here rather than deeper in.
 */
export function parseSiteSessionPacket(body: string): CookiePacket | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const candidate = parsed as { targetId?: unknown; status?: unknown; cookies?: unknown }
  if (typeof candidate.targetId !== 'string' || candidate.targetId.length === 0) return null
  if (typeof candidate.status !== 'string' || !COOKIE_PACKET_STATUSES.has(candidate.status)) {
    return null
  }
  if (!Array.isArray(candidate.cookies)) return null

  const cookies = candidate.cookies.filter(isBrowserCookie)
  if (cookies.length !== candidate.cookies.length) return null

  return {
    targetId: candidate.targetId,
    status: candidate.status as CookiePacketStatus,
    cookies
  }
}
