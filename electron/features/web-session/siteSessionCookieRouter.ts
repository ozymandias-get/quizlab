/**
 * Routing of the cookie packets the Chrome extension sends.
 *
 * A packet carries the cookies of exactly one site. Before anything is written
 * to a session, the packet has to pass three checks, in this order:
 *
 *   1. the site must be one the app knows about,
 *   2. the site must have an open account,
 *   3. every cookie in the packet must belong to that site.
 *
 * The order matters: an unknown site and a site without an open account are
 * refused before the domains are even looked at, and a packet that fails any
 * check is refused whole — no cookie of it is written anywhere.
 *
 * Only then is the packet matched to one of the open accounts. The caller
 * supplies the digests of the sessions the accounts have held and the digest
 * of this packet, because a new account needs the same digest and it is not
 * computed twice.
 *
 * The module is pure: it reads no clock, no disk and no session. The caller
 * supplies the target, the open accounts and the session's fingerprint.
 */

import type { ChromeExtensionCookie } from '@shared-core/types'

import { isCookieDomainAllowed } from './siteSessionCookies.js'
import {
  matchSiteSessionAccount,
  type SiteSessionAccountCandidate
} from './siteSessionFingerprint.js'
import type { SiteSessionTargetRow } from './siteSessionTargets.js'

/** Why a packet was refused. */
export type CookiePacketRejection =
  'unknown_target' | 'target_disabled' | 'domain_mismatch' | 'account_disabled'

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

/**
 * The outcome of routing a packet.
 *
 * `account` names the account the session belongs to. `new_account` asks the
 * caller to open one. `ambiguous` means the session cannot be attributed to an
 * account without the user, so the packet is held for a later decision.
 */
export type CookiePacketRoute =
  | {
      ok: true
      kind: 'account'
      target: SiteSessionTargetRow
      accountId: string
      cookies: CookiePacketCookie[]
    }
  | { ok: true; kind: 'new_account'; target: SiteSessionTargetRow; cookies: CookiePacketCookie[] }
  | { ok: false; kind: 'refused'; reason: CookiePacketRejection }
  | { ok: false; kind: 'ambiguous'; target: SiteSessionTargetRow; cookies: CookiePacketCookie[] }

/**
 * Routes a packet to the account of its site that it belongs to.
 *
 * `candidates` are the site's open accounts; `fingerprint` is the digest of
 * the session the packet carries (or null when it carries no identity cookie).
 * Both are computed by the caller, which also needs the fingerprint when it
 * opens the account the route asks for.
 */
export function routeCookiePacket(
  packet: CookiePacket,
  target: SiteSessionTargetRow | null,
  candidates: readonly SiteSessionAccountCandidate[],
  fingerprint: string | null
): CookiePacketRoute {
  if (!target) {
    return { ok: false, kind: 'refused', reason: 'unknown_target' }
  }

  if (candidates.length === 0) {
    return { ok: false, kind: 'refused', reason: 'target_disabled' }
  }

  const carriesForeignCookie = packet.cookies.some(
    (cookie) => !isCookieDomainAllowed(cookie.domain, target.cookieDomains)
  )
  if (carriesForeignCookie) {
    return { ok: false, kind: 'refused', reason: 'domain_mismatch' }
  }

  const match = matchSiteSessionAccount({ fingerprint, candidates })
  if (match.kind === 'matched') {
    return {
      ok: true,
      kind: 'account',
      target,
      accountId: match.accountId,
      cookies: packet.cookies
    }
  }
  if (match.kind === 'create') {
    return { ok: true, kind: 'new_account', target, cookies: packet.cookies }
  }

  return { ok: false, kind: 'ambiguous', target, cookies: packet.cookies }
}
