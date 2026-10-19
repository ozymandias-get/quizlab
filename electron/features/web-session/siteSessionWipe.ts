/**
 * Wiping the session of one site.
 *
 * When the user turns "pull the session from Chrome" off, the app must forget
 * that site: its cookies go, the storage of its origin goes, the credentials
 * its origin authenticated with go, and the next visit asks for a login again.
 *
 * The wipe is deliberately narrow. It touches the cookies of the domains the
 * target owns and the storage of the target's own origin — nothing else. A
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
} from './siteSessionImporter.js'
import type { SiteSessionTargetRow } from './siteSessionTargets.js'

/**
 * Removes the cookies of one site, clears the storage of its origin and the
 * credentials it authenticated with.
 *
 * The domain rule lives with the importer: both decide what belongs to a site,
 * and the two must not drift apart.
 */
export async function wipeSiteSession(
  targetSession: Session,
  target: SiteSessionTargetRow
): Promise<void> {
  // A cookie store that cannot be read must not stop the wipe: the storage of
  // the origin has to go as well, otherwise the site keeps its session.
  const existingCookies = await targetSession.cookies.get({}).catch(() => [])
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

  try {
    // The wipe is per origin: the partition can hold the data of other
    // origins, and clearing the whole partition would take them down too.
    await targetSession.clearStorageData({
      origin: `https://${target.hostname}`,
      storages: ['localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
    })
    // A site that authenticates with HTTP basic auth keeps its credentials in
    // the auth cache of the partition. Without this the next visit would
    // still be signed in.
    await targetSession.clearAuthCache()
  } finally {
    try {
      targetSession.flushStorageData()
    } catch {}
  }
}
