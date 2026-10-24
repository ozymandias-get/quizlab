/**
 * Routing of the cookie packets the Chrome extension sends.
 *
 * A packet carries the cookies of exactly one site. Before anything is written
 * to a session, the packet has to pass three checks, in this order:
 *
 *   1. the site must be one the app knows about,
 *   2. the site's switch must be on,
 *   3. every cookie in the packet must belong to that site.
 *
 * The order matters: an unknown site and a disabled site are refused before
 * the domains are even looked at, and a packet that fails any check is
 * refused whole — no cookie of it is written anywhere.
 *
 * The module is pure: it reads no clock, no disk and no session. The caller
 * supplies the targets and the answer to "is this site switched on".
 */

import type { ChromeExtensionCookie } from '@shared-core/types'

import { isCookieDomainAllowed } from './siteSessionCookies.js'
import type { SiteSessionTargetRow } from './siteSessionTargets.js'

/** Why a packet was refused. */
export type CookiePacketRejection = 'unknown_target' | 'target_disabled' | 'domain_mismatch'

/**
 * What the extension reports about a site.
 *
 * - `ok`: the extension read the site's cookies and they are in the packet
 * - `no_cookies`: the extension has permission but the browser holds no
 *   session cookie for the site
 * - `permission_missing`: the extension may not read the site at all
 */
export type CookiePacketStatus = 'ok' | 'no_cookies' | 'permission_missing'

/** One cookie as the Chrome extension reports it. */
type CookiePacketCookie = ChromeExtensionCookie

/** The packet the extension sends for one site. */
export interface CookiePacket {
  targetId: string
  status: CookiePacketStatus
  cookies: CookiePacketCookie[]
}

/** The outcome of routing a packet. */
export type CookiePacketRoute =
  | { ok: true; target: SiteSessionTargetRow; cookies: CookiePacketCookie[] }
  | { ok: false; reason: CookiePacketRejection }

/**
 * Routes a packet to the site it belongs to.
 *
 * `isEnabled` is asked synchronously so that a packet that arrives right
 * after the user switched a site off is refused on the spot, rather than
 * after an await that could read a state the user has already changed.
 */
export function routeCookiePacket(
  packet: CookiePacket,
  targets: readonly SiteSessionTargetRow[],
  isEnabled: (siteId: string) => boolean
): CookiePacketRoute {
  const target = targets.find((candidate) => candidate.siteId === packet.targetId)
  if (!target) {
    return { ok: false, reason: 'unknown_target' }
  }

  if (!isEnabled(packet.targetId)) {
    return { ok: false, reason: 'target_disabled' }
  }

  const carriesForeignCookie = packet.cookies.some(
    (cookie) => !isCookieDomainAllowed(cookie.domain, target.cookieDomains)
  )
  if (carriesForeignCookie) {
    return { ok: false, reason: 'domain_mismatch' }
  }

  return { ok: true, target, cookies: packet.cookies }
}
