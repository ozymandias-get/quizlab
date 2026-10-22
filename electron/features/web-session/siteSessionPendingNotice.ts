/**
 * The session that waits for the account it belongs to.
 *
 * A session the bridge could not attribute to an account is held in memory
 * until the user says which account it belongs to. The question is asked in
 * the settings page, so the app has to tell the renderer that the question
 * is waiting: without the change the page keeps showing the list it had, and
 * the question only appears after the user left the page and came back.
 *
 * The module is on its own because the bridge is at the edge of the size
 * limit, and because the rule "a state that changed is told to the renderer"
 * belongs to one place: the pending session is the only state of the feature
 * that is not written to the state file.
 */

import type { ChromeExtensionCookie } from '@shared-core/types'

import { broadcastSiteSessionsChanged } from './siteSessionBroadcast.js'
import { invalidateSiteSessionListCache } from './siteSessionListCache.js'
import { setPendingSiteSession } from './siteSessionPendingSessions.js'

/**
 * Holds a session for a site and tells the renderer that it waits.
 *
 * The list that is kept is dropped first: it was built before the session
 * arrived, so it cannot show the question.
 */
export async function storePendingSiteSession(
  siteId: string,
  cookies: ChromeExtensionCookie[]
): Promise<void> {
  setPendingSiteSession(siteId, cookies)
  invalidateSiteSessionListCache()
  await broadcastSiteSessionsChanged()
}
