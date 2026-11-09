/**
 * Wiping the session of one site.
 *
 * When the user turns "pull the session from Chrome" off, the app must forget
 * that site: its cookies go, the storage of its origin goes, the credentials
 * its origin authenticated with go, and the next visit asks for a login again.
 *
 * The wipe is deliberately narrow. It touches the cookies of the domains the
 * target owns and the storage of the target's own origins — nothing else. A
 * partition-wide `clearStorageData()` would throw away the data of every
 * other origin that lives in the same partition, and a cookie sweep that
 * ignores the domain list would sign the user out of a neighbour as well.
 */

import type { Session } from 'electron'

import { Logger } from '../../core/logger.js'
import {
  cookieRemovalUrls,
  isCookieDomainAllowed,
  normalizeCookieDomain
} from './siteSessionCookies.js'
import type { SiteSessionTargetRow } from './siteSessionTargets.js'

/**
 * Removes the cookies of one site, clears the storage of its origin and the
 * credentials it authenticated with.
 *
 * The domain rule lives in `siteSessionCookies.ts`: the writer of a session,
 * the reader of one and this eraser all decide what belongs to a site, and
 * the three must not drift apart.
 */
/** A wipe that finished some categories but not all of them. */
export class SiteSessionWipeError extends Error {
  constructor(readonly result: SiteSessionWipeResult) {
    super('The site session could not be completely cleared.')
    this.name = 'SiteSessionWipeError'
  }
}

export interface SiteSessionWipeOptions {
  /**
   * Whether the partition-wide auth cache may be cleared.
   *
   * Electron's `clearAuthCache()` has no origin scope. A partition that is
   * shared with another site (or anything else) must not lose credentials that
   * do not belong to this wipe, so callers pass `false` for a shared partition.
   */
  clearAuthCache?: boolean
}

/**
 * What a wipe actually achieved.
 *
 * A wipe is not atomic: cookies, origin storage and the auth cache are three
 * independent stores. The result reports each one instead of collapsing every
 * partial outcome into a single "failed".
 */
export interface SiteSessionWipeResult {
  ok: boolean
  cookiesCleared: boolean
  storageCleared: boolean
  /** Null when the auth cache was not touched on purpose. */
  authCacheCleared: boolean | null
  flushFailed: boolean
}

export async function wipeSiteSession(
  targetSession: Session,
  target: SiteSessionTargetRow,
  options: SiteSessionWipeOptions = {}
): Promise<SiteSessionWipeResult> {
  // A cookie store that cannot be read must not stop the wipe: the storage of
  // the origin has to go as well, otherwise the site keeps its session.
  let cookieReadFailed = false
  const existingCookies = await targetSession.cookies.get({}).catch(() => {
    cookieReadFailed = true
    return []
  })
  const removals: { domain: string; removal: Promise<unknown> }[] = []

  for (const cookie of existingCookies) {
    // Only the cookies of this site's domains are ours to delete.
    if (!isCookieDomainAllowed(cookie.domain, target.cookieDomains)) continue

    const domain = normalizeCookieDomain(cookie.domain) ?? ''
    for (const url of cookieRemovalUrls(cookie.domain, cookie.path, cookie.secure)) {
      removals.push({ domain, removal: targetSession.cookies.remove(url, cookie.name) })
    }
  }

  const outcomes = await Promise.allSettled(removals.map((entry) => entry.removal))
  const failuresByDomain = new Map<string, number>()
  for (const [index, outcome] of outcomes.entries()) {
    if (outcome.status !== 'rejected') continue
    const domain = removals[index].domain
    failuresByDomain.set(domain, (failuresByDomain.get(domain) ?? 0) + 1)
  }
  for (const [domain, count] of failuresByDomain) {
    Logger.warn(`[SiteSessionWipe] ${count} cookie(s) of "${domain}" could not be removed.`)
  }

  let storageFailed = false
  // The wipe is per origin: the partition can hold the data of other origins,
  // and clearing the whole partition would take them down too. A site may live
  // on more than one origin — the Google group on four — and every one of them
  // has to be cleared, or the site keeps its session.
  for (const origin of target.origins) {
    try {
      await targetSession.clearStorageData({
        origin,
        storages: ['localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
      })
    } catch {
      storageFailed = true
      Logger.warn(`[SiteSessionWipe] Storage of "${origin}" could not be cleared.`)
    }
  }

  // A site that authenticates with HTTP basic auth keeps its credentials in
  // the auth cache of the partition. Without this the next visit would still
  // be signed in — but the API has no origin scope, so a shared partition is
  // left untouched by the caller.
  let authCacheCleared: boolean | null = null
  if (options.clearAuthCache !== false) {
    try {
      await targetSession.clearAuthCache()
      authCacheCleared = true
    } catch (error) {
      authCacheCleared = false
      Logger.warn('[SiteSessionWipe] The auth cache could not be cleared:', error)
    }
  }

  // The flush is part of the wipe: data that did not reach the disk can come
  // back after a restart, so a failed flush is a failed wipe.
  let flushFailed = false
  try {
    await targetSession.flushStorageData()
  } catch (error) {
    flushFailed = true
    Logger.warn('[SiteSessionWipe] Storage could not be flushed:', error)
  }

  const cookiesCleared = !cookieReadFailed && failuresByDomain.size === 0
  const storageCleared = !storageFailed
  const result: SiteSessionWipeResult = {
    ok: cookiesCleared && storageCleared && authCacheCleared !== false && !flushFailed,
    cookiesCleared,
    storageCleared,
    authCacheCleared,
    flushFailed
  }

  if (!result.ok) {
    Logger.warn(
      `[SiteSessionWipe] The wipe of "${target.siteId}" was incomplete: ` +
        `cookies=${cookiesCleared ? 'cleared' : 'failed'}, ` +
        `storage=${storageCleared ? 'cleared' : 'failed'}, ` +
        `auth=${authCacheCleared === null ? 'skipped' : authCacheCleared ? 'cleared' : 'failed'}, ` +
        `flush=${flushFailed ? 'failed' : 'ok'}.`
    )
  }

  return result
}
