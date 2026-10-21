/**
 * The sessions the bridge could not attribute to an account.
 *
 * A site whose accounts share no identity cookie cannot tell two open
 * accounts apart: a session that arrives without a fingerprint could belong to
 * either of them, and writing it into the wrong cookie jar would overwrite the
 * session the user keeps there. The bridge therefore writes nothing and holds
 * the session here until the user says which account it belongs to.
 *
 * The session lives in memory and only in memory: a packet may carry hundreds
 * of kilobytes of cookies, and the state file is not a place for them. The
 * app restarting loses the pending session; the extension pushes it again
 * with its next round.
 *
 * A site holds one pending session at a time. A newer session for the same
 * site replaces the older one: it is what Chrome holds now, and the user has
 * to answer the question about that one.
 */

import type { ChromeExtensionCookie } from '@shared-core/types'

/** The session of a site that waits for the user to pick its account. */
export interface PendingSiteSession {
  siteId: string
  cookies: ChromeExtensionCookie[]
}

/** The pending session of every site that has one. */
const pendingSessions = new Map<string, PendingSiteSession>()

/** Holds a session for a site until the user picks the account it belongs to. */
export function setPendingSiteSession(siteId: string, cookies: ChromeExtensionCookie[]): void {
  pendingSessions.set(siteId, { siteId, cookies })
}

/** The session held for a site, or null when there is none. */
export function getPendingSiteSession(siteId: string): PendingSiteSession | null {
  return pendingSessions.get(siteId) ?? null
}

/** Forgets the pending session of a site: it was resolved or is not relevant. */
export function clearPendingSiteSession(siteId: string): void {
  pendingSessions.delete(siteId)
}

/** The sites whose sessions wait for the user, in the order they arrived. */
export function listPendingSiteSessionIds(): string[] {
  return [...pendingSessions.keys()]
}
