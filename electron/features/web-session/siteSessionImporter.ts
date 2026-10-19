/**
 * Per-site cookie import.
 *
 * The Chrome extension hands over the cookies of one site; this module writes
 * them into that site's own Electron session partition and drops the cookies of
 * the same site that the browser no longer sends.
 *
 * The safety of the whole feature rests on one rule: a cookie is written only
 * when its domain belongs to the site that is being imported. The allowed
 * domains are a parameter and never a global — the caller passes the target's
 * own domain list — so a cookie of another site can neither be written into
 * this session nor be deleted from it.
 *
 * The rules about how a cookie is written (host-only vs. domain-wide, the
 * scheme, the expiry) come from the Google-only implementation this module
 * generalises; they are the details that are easy to get wrong.
 */

import type { Session } from 'electron'

import { Logger } from '../../core/logger.js'

/** A cookie as the Chrome extension reports it. */
export interface ExternalBrowserCookie {
  name: string
  value: string
  domain: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None' | 'Unspecified'
  expires?: number
}

/**
 * The scope of a cookie: a host-only cookie or a domain-wide one.
 *
 * The scope is part of the identity of a cookie: a host-only cookie and a
 * domain-wide cookie of the same name and path are two different cookies, and
 * Chromium sends both of them.
 */
type CookieScope = 'host' | 'domain'

/**
 * The domain of a cookie in its comparable form: trimmed and lowercased.
 *
 * The leading dot survives, because it is what tells a domain-wide cookie
 * apart from a host-only one — the payload builder needs that difference.
 */
export function normalizeCookieDomain(domain: string | null | undefined): string | null {
  if (typeof domain !== 'string') return null
  const normalized = domain.trim().toLowerCase()
  return normalized || null
}

/** The host of a domain: the leading dots of a domain-wide cookie are dropped. */
function domainHost(domain: string): string {
  return domain.replace(/^\.+/, '')
}

/**
 * Whether a cookie domain belongs to the site that owns `allowedDomains`.
 *
 * A domain belongs when it is the allowed domain itself or a subdomain of it:
 * `.chatgpt.com` allows `chatgpt.com` and `mail.chatgpt.com`, but never
 * `notchatgpt.com` or `chatgpt.com.evil.com`.
 */
export function isCookieDomainAllowed(
  domain: string | null | undefined,
  allowedDomains: readonly string[]
): boolean {
  const normalized = normalizeCookieDomain(domain)
  if (!normalized) return false
  const host = domainHost(normalized)
  if (!host) return false

  return allowedDomains.some((allowed) => {
    const allowedHost = domainHost(normalizeCookieDomain(allowed) ?? '')
    if (!allowedHost) return false
    return host === allowedHost || host.endsWith(`.${allowedHost}`)
  })
}

/**
 * The URLs a cookie of this domain and path may be stored under.
 *
 * A secure cookie only ever lives under https; a plain one is looked up under
 * both schemes, because the browser may have stored it either way.
 */
export function cookieRemovalUrls(
  domain: string | null | undefined,
  path: string | undefined,
  secure: boolean | undefined
): string[] {
  const normalized = normalizeCookieDomain(domain)
  if (!normalized) return []
  const host = domainHost(normalized)
  if (!host) return []

  const cookiePath = path || '/'
  const schemes = secure ? ['https'] : ['https', 'http']
  return schemes.map((scheme) => `${scheme}://${host}${cookiePath}`)
}

/**
 * The scope of a cookie the browser sends.
 *
 * The browser marks a domain-wide cookie with a leading dot in its domain; a
 * host-only cookie carries the bare host.
 */
function packetScope(domain: string): CookieScope {
  return domain.startsWith('.') ? 'domain' : 'host'
}

/**
 * The scope of a cookie the session holds.
 *
 * Electron reports the scope in `hostOnly`. When the flag is missing the two
 * scopes cannot be told apart, and the caller keeps the cookie rather than
 * deleting a session the user may still need.
 */
function sessionScope(cookie: Electron.Cookie): CookieScope | 'unknown' {
  if (cookie.hostOnly === true) return 'host'
  if (cookie.hostOnly === false) return 'domain'
  return 'unknown'
}

/**
 * The identity of a cookie inside a session: host, name and path.
 *
 * The host drops the leading dot of the domain, because the scope carries that
 * difference on its own and the two sides of the transfer do not have to
 * agree on how they spell it.
 */
function cookieIdentity(host: string, name: string | undefined, path: string | undefined): string {
  return `${host}::${(name ?? '').trim()}::${path || '/'}`
}

/** The identity of a cookie including its scope. */
function cookieKey(
  host: string,
  name: string | undefined,
  path: string | undefined,
  scope: CookieScope
): string {
  return `${cookieIdentity(host, name, path)}::${scope}`
}

function normalizeSameSite(
  sameSite: ExternalBrowserCookie['sameSite']
): Electron.CookiesSetDetails['sameSite'] {
  if (sameSite === 'Lax') return 'lax'
  if (sameSite === 'Strict') return 'strict'
  if (sameSite === 'None') return 'no_restriction'
  return 'unspecified'
}

/**
 * The Electron payload of a browser cookie, or null when the cookie cannot be
 * written.
 *
 * A null payload is a refusal: the cookie carries no usable name, or it is
 * not one of the site's own cookies.
 */
function buildElectronCookiePayload(
  cookie: ExternalBrowserCookie,
  allowedDomains: readonly string[]
): Electron.CookiesSetDetails | null {
  const domain = normalizeCookieDomain(cookie.domain)
  const name = typeof cookie.name === 'string' ? cookie.name.trim() : ''
  if (!domain || !name) return null
  if (!isCookieDomainAllowed(domain, allowedDomains)) return null

  const host = domainHost(domain)
  if (!host) return null
  const cookiePath = cookie.path || '/'
  const payload: Electron.CookiesSetDetails = {
    url: `${cookie.secure ? 'https' : 'http'}://${host}${cookiePath}`,
    name,
    value: cookie.value,
    path: cookiePath,
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    sameSite: normalizeSameSite(cookie.sameSite)
  }

  // Electron normalises an explicit domain with a leading dot, which turns
  // host-only cookies into domain cookies. Preserve host-only cookies by
  // omitting `domain` unless the source cookie was already scoped broadly.
  if (domain.startsWith('.')) {
    payload.domain = domain
  }

  if (typeof cookie.expires === 'number' && Number.isFinite(cookie.expires) && cookie.expires > 0) {
    // Normalize seconds vs milliseconds: Unix timestamps in seconds are
    // ~1.5B-2B (year 2020-2035). Millisecond timestamps would be ~1.5T-2T.
    // If the value is > 1e12 (year 5138+), it is likely milliseconds.
    const expires =
      cookie.expires > 1e12 ? Math.floor(cookie.expires / 1000) : Math.floor(cookie.expires)
    payload.expirationDate = expires
  }

  return payload
}

/** Writes one cookie and reports whether it made it into the session. */
async function writeCookie(
  targetSession: Session,
  payload: Electron.CookiesSetDetails,
  domain: string
): Promise<boolean> {
  try {
    await targetSession.cookies.set(payload)
    return true
  } catch (error) {
    // The cookie value never reaches the log: only the domain and the reason.
    Logger.warn(
      `[SiteSessionImporter] A cookie of "${domain}" could not be written: ` +
        `${error instanceof Error ? error.message : String(error)}`
    )
    return false
  }
}

/** Removes one cookie and reports whether it is gone. */
async function removeCookie(
  targetSession: Session,
  url: string,
  name: string,
  domain: string
): Promise<boolean> {
  try {
    await targetSession.cookies.remove(url, name)
    return true
  } catch (error) {
    Logger.warn(
      `[SiteSessionImporter] A cookie of "${domain}" could not be removed: ` +
        `${error instanceof Error ? error.message : String(error)}`
    )
    return false
  }
}

/**
 * Whether the browser still sends the cookie the session holds.
 *
 * The scope decides: only the cookie the packet carries with the same scope is
 * still sent. A host-only cookie and a domain-wide cookie of the same name and
 * path are two different cookies, and the browser sends one of them now.
 */
function isStillSent(
  existing: Electron.Cookie,
  host: string,
  incoming: ReadonlySet<string>
): boolean {
  const scope = sessionScope(existing)
  if (scope === 'unknown') {
    // The scope cannot be told apart: keep the cookie rather than delete a
    // session the user may still need.
    return (
      incoming.has(cookieKey(host, existing.name, existing.path, 'host')) ||
      incoming.has(cookieKey(host, existing.name, existing.path, 'domain'))
    )
  }
  return incoming.has(cookieKey(host, existing.name, existing.path, scope))
}

/**
 * Drops the cookies of this site that the browser no longer sends.
 *
 * Only the domains of the site are touched: a neighbour's cookie that shares
 * the partition is none of this site's business. A cookie whose write was
 * rejected is kept as well: the packet did not make it into the session, so
 * the session's cookie is all the user has left.
 */
async function removeStaleCookies(
  targetSession: Session,
  incoming: ReadonlySet<string>,
  failedIdentities: ReadonlySet<string>,
  allowedDomains: readonly string[]
): Promise<void> {
  const existingCookies = await targetSession.cookies.get({}).catch(() => [])
  const removals: Promise<boolean>[] = []

  for (const existing of existingCookies) {
    if (!isCookieDomainAllowed(existing.domain, allowedDomains)) continue

    const host = domainHost(normalizeCookieDomain(existing.domain) ?? '')
    if (!host) continue

    if (failedIdentities.has(cookieIdentity(host, existing.name, existing.path))) continue
    if (isStillSent(existing, host, incoming)) continue

    const domain = normalizeCookieDomain(existing.domain) ?? ''
    for (const url of cookieRemovalUrls(existing.domain, existing.path, existing.secure)) {
      removals.push(removeCookie(targetSession, url, existing.name, domain))
    }
  }

  await Promise.all(removals)
}

/**
 * Writes the cookies of one site into that site's session.
 *
 * `allowedDomains` is the domain list of the target: a cookie whose domain is
 * outside it is not written at all — not written elsewhere, not logged.
 *
 * The return value counts the outcome: `imported` cookies made it into the
 * session, `failed` ones were rejected by Chromium. A cookie the app refuses
 * before the write is not one of them; it is reported in the log instead.
 */
export async function importExternalCookies(
  targetSession: Session,
  cookies: ExternalBrowserCookie[],
  allowedDomains: readonly string[]
): Promise<{ imported: number; failed: number }> {
  const writes: { payload: Electron.CookiesSetDetails; domain: string; key: string }[] = []
  const refusedByDomain = new Map<string, number>()

  for (const cookie of cookies) {
    const domain = normalizeCookieDomain(cookie.domain)
    // A cookie of another site is not ours: it is neither written nor logged.
    if (!domain || !isCookieDomainAllowed(domain, allowedDomains)) continue

    const payload = buildElectronCookiePayload(cookie, allowedDomains)
    if (!payload) {
      // The cookie belongs to the site but cannot be written.
      refusedByDomain.set(domain, (refusedByDomain.get(domain) ?? 0) + 1)
      continue
    }

    const host = domainHost(domain)
    writes.push({
      payload,
      domain,
      key: cookieKey(host, payload.name, payload.path, packetScope(domain))
    })
  }

  for (const [domain, count] of refusedByDomain) {
    Logger.warn(
      `[SiteSessionImporter] ${count} cookie(s) of "${domain}" were refused: they carry no usable name.`
    )
  }

  const outcomes = await Promise.all(
    writes.map((write) => writeCookie(targetSession, write.payload, write.domain))
  )
  const imported = outcomes.filter(Boolean).length
  const failed = outcomes.length - imported

  const incoming = new Set<string>()
  const failedIdentities = new Set<string>()
  for (const [index, outcome] of outcomes.entries()) {
    const write = writes[index]
    if (outcome) {
      incoming.add(write.key)
      continue
    }
    const host = domainHost(write.domain)
    failedIdentities.add(cookieIdentity(host, write.payload.name, write.payload.path))
  }

  if (failed > 0) {
    Logger.warn(
      `[SiteSessionImporter] ${failed} of ${writes.length} cookie(s) could not be written.`
    )
  }

  // The stale cleanup runs only when a cookie actually made it into the
  // session. A packet whose writes were all rejected must not leave the user
  // signed out with nothing imported, and an empty packet must not delete
  // anything at all.
  if (imported > 0) {
    await removeStaleCookies(targetSession, incoming, failedIdentities, allowedDomains)
  }

  try {
    targetSession.flushStorageData()
  } catch {}

  return { imported, failed }
}
