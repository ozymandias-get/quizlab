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
 * this session nor be deleted from it. The rule itself lives in
 * `siteSessionCookies.ts`, which the router and the wipe read as well.
 *
 * The rules about how a cookie is written (host-only vs. domain-wide, the
 * scheme, the expiry) come from the Google-only implementation this module
 * generalises; they are the details that are easy to get wrong.
 */

import type { Session } from 'electron'

import { Logger } from '../../core/logger.js'
import {
  cookieRemovalUrls,
  domainHost,
  isCookieDomainAllowed,
  normalizeCookieDomain
} from './siteSessionCookies.js'

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

/** The identity of a browser-reported cookie. */
export function externalCookieKey(cookie: ExternalBrowserCookie): string {
  const domain = normalizeCookieDomain(cookie.domain) ?? ''
  return cookieKey(domainHost(domain), cookie.name, cookie.path, packetScope(domain))
}

/** The identity of a cookie already in the target session. */
export function electronCookieKey(cookie: Electron.Cookie): string | null {
  const host = domainHost(normalizeCookieDomain(cookie.domain) ?? '')
  const scope = sessionScope(cookie)
  if (!host || scope === 'unknown') return null
  return cookieKey(host, cookie.name, cookie.path, scope)
}

/** Rewrites an Electron cookie as the browser-shaped cookie the importer reads. */
function toExternalCookie(cookie: Electron.Cookie): ExternalBrowserCookie {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.hostOnly
      ? domainHost(cookie.domain ?? '')
      : cookie.hostOnly === false && cookie.domain
        ? `.${domainHost(cookie.domain)}`
        : (cookie.domain ?? ''),
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite:
      cookie.sameSite === 'lax'
        ? 'Lax'
        : cookie.sameSite === 'strict'
          ? 'Strict'
          : cookie.sameSite === 'no_restriction'
            ? 'None'
            : 'Unspecified',
    expires: cookie.expirationDate
  }
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
 * the partition is none of this site's business. Names shared with imported
 * cookies are kept because Electron cannot target an exact cookie for removal.
 */
interface IncomingCookieIdentity {
  key: string
  host: string
  name: string
  path: string
}

/**
 * Whether removing an existing cookie by URL+name could also remove an
 * incoming cookie with the same name.
 *
 * Electron removes by URL and name, not by the exact cookie identity. When a
 * namesake shares the host and an overlapping path, the removal is skipped:
 * deleting a freshly written cookie would be worse than leaving a stale one.
 */
function removalConflictsWithIncoming(
  existing: Electron.Cookie,
  host: string,
  incoming: readonly IncomingCookieIdentity[]
): boolean {
  const existingPath = existing.path || '/'
  return incoming.some((cookie) => {
    if (cookie.name !== existing.name || cookie.host !== host) return false
    return cookie.path.startsWith(existingPath) || existingPath.startsWith(cookie.path)
  })
}

/**
 * Drops the cookies of this site that the browser no longer sends.
 *
 * Only the domains of the site are touched: a neighbour's cookie that shares
 * the partition is none of this site's business. A stale cookie is matched by
 * its full identity (host, name, path and scope); a same-named cookie under a
 * different domain or path is no reason to keep it.
 */
async function removeStaleCookies(
  targetSession: Session,
  incoming: readonly IncomingCookieIdentity[],
  allowedDomains: readonly string[]
): Promise<number> {
  let existingCookies: Electron.Cookie[]
  try {
    existingCookies = await targetSession.cookies.get({})
  } catch {
    Logger.warn('[SiteSessionImporter] Existing cookies could not be read for cleanup.')
    return 1
  }
  const incomingKeys = new Set(incoming.map((cookie) => cookie.key))
  const removals: Promise<boolean>[] = []

  for (const existing of existingCookies) {
    if (!isCookieDomainAllowed(existing.domain, allowedDomains)) continue

    const host = domainHost(normalizeCookieDomain(existing.domain) ?? '')
    if (!host) continue
    if (isStillSent(existing, host, incomingKeys)) continue

    // Electron removes by URL and name, not by exact domain, path and scope.
    // A removal can therefore also delete a freshly imported namesake.
    if (removalConflictsWithIncoming(existing, host, incoming)) {
      Logger.warn(
        `[SiteSessionImporter] A stale cookie of "${host}" was kept because the removal API ` +
          `cannot target its identity without touching an imported namesake.`
      )
      continue
    }

    const domain = normalizeCookieDomain(existing.domain) ?? ''
    for (const url of cookieRemovalUrls(existing.domain, existing.path, existing.secure)) {
      removals.push(removeCookie(targetSession, url, existing.name, domain))
    }
  }

  return (await Promise.all(removals)).filter((removed) => !removed).length
}

/** Removes only the cookies whose full identity is in `keys`. */
async function removeCookiesByKeys(
  targetSession: Session,
  keys: ReadonlySet<string>,
  allowedDomains: readonly string[]
): Promise<boolean> {
  if (keys.size === 0) return true
  let existingCookies: Electron.Cookie[]
  try {
    existingCookies = await targetSession.cookies.get({})
  } catch {
    return false
  }

  let failed = false
  for (const cookie of existingCookies) {
    if (!isCookieDomainAllowed(cookie.domain, allowedDomains)) continue
    const key = electronCookieKey(cookie)
    if (!key || !keys.has(key)) continue
    const domain = normalizeCookieDomain(cookie.domain) ?? ''
    for (const url of cookieRemovalUrls(cookie.domain, cookie.path, cookie.secure)) {
      if (!(await removeCookie(targetSession, url, cookie.name, domain))) failed = true
    }
  }
  return !failed
}

/** Whether any of the identities still exist in the target. */
async function hasAnyCookieKey(
  targetSession: Session,
  keys: ReadonlySet<string>,
  allowedDomains: readonly string[]
): Promise<boolean> {
  if (keys.size === 0) return false
  try {
    const existing = await targetSession.cookies.get({})
    return existing.some((cookie) => {
      if (!isCookieDomainAllowed(cookie.domain, allowedDomains)) return false
      const key = electronCookieKey(cookie)
      return key !== null && keys.has(key)
    })
  } catch {
    // An unreadable store cannot prove that the rollback is complete.
    return true
  }
}

export interface ImportExternalCookiesOptions {
  /**
   * Snapshot the target before writing and restore it when any cookie fails.
   *
   * Used by the Chrome bridge: a half-written packet must not leave a session
   * that mixes the old and the new state.
   */
  rollbackOnPartialFailure?: boolean
}

export interface ImportExternalCookiesResult {
  imported: number
  failed: number
  rolledBack?: boolean
  rollbackFailed?: boolean
  /** Cookies reached the store but the explicit disk flush failed. */
  flushFailed?: boolean
}

/**
 * Writes the cookies of one site into that site's session.
 *
 * `allowedDomains` is the domain list of the target: a cookie whose domain is
 * outside it is not written at all — not written elsewhere, not logged.
 *
 * The return value counts the outcome: `imported` cookies made it into the
 * session, `failed` ones were rejected by Chromium or refused before writing.
 */
export async function importExternalCookies(
  targetSession: Session,
  cookies: ExternalBrowserCookie[],
  allowedDomains: readonly string[],
  options: ImportExternalCookiesOptions = {}
): Promise<ImportExternalCookiesResult> {
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

  // A rollback without a snapshot would be a guess. If the target cannot be
  // read, fail closed instead of writing cookies that can never be undone.
  let snapshot: ExternalBrowserCookie[] | null = null
  if (options.rollbackOnPartialFailure && writes.length > 0) {
    try {
      const existing = await targetSession.cookies.get({})
      snapshot = existing
        .filter((cookie) => isCookieDomainAllowed(cookie.domain, allowedDomains))
        .map(toExternalCookie)
    } catch {
      Logger.warn(
        '[SiteSessionImporter] The target could not be read for a rollback snapshot; refusing the import.'
      )
      return {
        imported: 0,
        failed: writes.length + [...refusedByDomain.values()].reduce((a, b) => a + b, 0),
        rolledBack: true,
        rollbackFailed: true
      }
    }
  }

  const outcomes = await Promise.all(
    writes.map((write) => writeCookie(targetSession, write.payload, write.domain))
  )
  const imported = outcomes.filter(Boolean).length
  let failed = outcomes.length - imported + [...refusedByDomain.values()].reduce((a, b) => a + b, 0)

  const incoming: IncomingCookieIdentity[] = []
  for (const [index, outcome] of outcomes.entries()) {
    if (!outcome) continue
    const write = writes[index]
    const host = domainHost(write.domain)
    incoming.push({
      key: write.key,
      host,
      name: write.payload.name ?? '',
      path: write.payload.path || '/'
    })
  }

  // Only a complete write is a reliable basis for deleting old cookies. A
  // cleanup failure is part of the same import transaction: it must roll back
  // together with a partial write instead of reporting a half-changed session.
  if (imported > 0 && failed === 0) {
    failed += await removeStaleCookies(targetSession, incoming, allowedDomains)
  }

  const flush = async (context: string): Promise<boolean> => {
    try {
      await targetSession.flushStorageData()
      return false
    } catch (error) {
      Logger.warn(`[SiteSessionImporter] Storage could not be flushed${context}:`, error)
      return true
    }
  }

  if (failed > 0 && options.rollbackOnPartialFailure && snapshot !== null) {
    const snapshotKeys = new Set(snapshot.map(externalCookieKey))
    const newOnlyKeys = new Set(
      writes.map((write) => write.key).filter((key) => !snapshotKeys.has(key))
    )
    const restoredImport = await importExternalCookies(targetSession, snapshot, allowedDomains)
    const removed = await removeCookiesByKeys(targetSession, newOnlyKeys, allowedDomains)
    const stillThere = await hasAnyCookieKey(targetSession, newOnlyKeys, allowedDomains)
    const rollbackFailed =
      restoredImport.failed > 0 || restoredImport.flushFailed === true || !removed || stillThere
    const flushFailed = await flush(' after a rollback')
    Logger.warn(
      `[SiteSessionImporter] ${failed} cookie(s) could not be written or cleaned up; ` +
        `rolled back ${rollbackFailed ? 'incompletely' : 'to the previous session'}.`
    )
    return {
      imported,
      failed,
      rolledBack: true,
      rollbackFailed,
      ...(flushFailed ? { flushFailed: true } : {})
    }
  }

  if (failed > 0) {
    Logger.warn(`[SiteSessionImporter] ${failed} cookie(s) could not be written or cleaned up.`)
  }

  const flushFailed = await flush('')
  return { imported, failed, ...(flushFailed ? { flushFailed: true } : {}) }
}
