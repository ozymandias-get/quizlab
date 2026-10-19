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

function normalizeSameSite(
  sameSite: ExternalBrowserCookie['sameSite']
): Electron.CookiesSetDetails['sameSite'] {
  if (sameSite === 'Lax') return 'lax'
  if (sameSite === 'Strict') return 'strict'
  if (sameSite === 'None') return 'no_restriction'
  return 'unspecified'
}

/**
 * The Electron payload of a browser cookie, or null when the cookie must not
 * be written.
 *
 * A null payload is a refusal in both cases: the domain is not one of the
 * site's own domains, or the cookie carries no usable name.
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

/**
 * The identity of a cookie inside a session: host, name and path.
 *
 * The leading dot of the domain is dropped on both sides. Electron reports
 * every domain with a preceding dot, while the browser reports a host-only
 * cookie without one; comparing the raw strings would make the cookie that
 * was just written look like a different one, and the stale cleanup would
 * delete it right away.
 */
function cookieKey(
  name: string,
  domain: string | null | undefined,
  path: string | undefined
): string {
  const normalized = normalizeCookieDomain(domain)
  const host = normalized ? domainHost(normalized) : ''
  return `${host}::${name.trim()}::${path || '/'}`
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
 * Drops the cookies of this site that the browser no longer sends.
 *
 * Only the domains of the site are touched: a neighbour's cookie that shares
 * the partition is none of this site's business.
 */
async function removeStaleCookies(
  targetSession: Session,
  incoming: ReadonlySet<string>,
  allowedDomains: readonly string[]
): Promise<void> {
  const existingCookies = await targetSession.cookies.get({}).catch(() => [])
  const removals: Promise<boolean>[] = []

  for (const existing of existingCookies) {
    if (!isCookieDomainAllowed(existing.domain, allowedDomains)) continue
    if (incoming.has(cookieKey(existing.name, existing.domain, existing.path))) continue

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
 * session, `failed` ones were rejected by Chromium.
 */
export async function importExternalCookies(
  targetSession: Session,
  cookies: ExternalBrowserCookie[],
  allowedDomains: readonly string[]
): Promise<{ imported: number; failed: number }> {
  const incoming = new Set<string>()
  const writes: { payload: Electron.CookiesSetDetails; domain: string }[] = []

  for (const cookie of cookies) {
    const payload = buildElectronCookiePayload(cookie, allowedDomains)
    if (!payload) continue
    incoming.add(cookieKey(cookie.name, cookie.domain, cookie.path))
    writes.push({ payload, domain: normalizeCookieDomain(cookie.domain) ?? '' })
  }

  const outcomes = await Promise.all(
    writes.map((write) => writeCookie(targetSession, write.payload, write.domain))
  )
  const imported = outcomes.filter(Boolean).length
  const failed = outcomes.length - imported

  if (failed > 0) {
    Logger.warn(
      `[SiteSessionImporter] ${failed} of ${writes.length} cookie(s) could not be written.`
    )
  }

  // The stale cleanup runs only when the packet actually carried a cookie of
  // this site. An empty packet — or one that carried nothing but foreign
  // domains — must never delete the session the user has in the app.
  if (writes.length > 0) {
    await removeStaleCookies(targetSession, incoming, allowedDomains)
  }

  try {
    targetSession.flushStorageData()
  } catch {}

  return { imported, failed }
}
