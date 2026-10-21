/**
 * The short-lived cache of the site list.
 *
 * The settings page asks for the whole list every time it is opened, and two
 * consumers ask for it at the same time: the button in the bottom bar and the
 * settings behind it. Building the list is not free — it reads the session of
 * every site the app knows — so the answer is kept for a couple of seconds
 * and the second reader is served from it.
 *
 * The cache never survives a change. The account is the unit the state lives
 * in, so every account action — a switch that was turned, a session that was
 * cleared, a name or the active account that changed, an account that was
 * added or removed, a pending session that was resolved — drops the kept list
 * as a whole: it holds every account of every site. The next reader therefore
 * gets the state the app really has.
 *
 * The cache lives in its own module because the two sides of the feature
 * have to agree on it: the service builds the list, and the bridge — which
 * imports the cookies — has to be able to drop it.
 */

import type { SiteSessionListResult } from '../../../shared/types/siteSession.js'

/** How long an answer may be reused. */
const LIST_CACHE_TTL_MS = 2000

let cached: { list: SiteSessionListResult; at: number } | null = null

/**
 * The list of the last read, when it may still be used.
 *
 * A list that is older than the lifetime of the cache is dropped: the state
 * of a site may have changed while it was kept.
 */
export function readCachedSiteSessionList(): SiteSessionListResult | null {
  if (!cached) return null
  if (Date.now() - cached.at >= LIST_CACHE_TTL_MS) {
    cached = null
    return null
  }
  return cached.list
}

/** Remembers the list that was built. */
export function writeCachedSiteSessionList(list: SiteSessionListResult): void {
  cached = { list, at: Date.now() }
}

/** Drops the list: an account changed in a way the list would not show. */
export function invalidateSiteSessionListCache(): void {
  cached = null
}
