/**
 * Telling the open views of a site that its session changed.
 *
 * Importing cookies into a partition does not change the page that is already
 * loaded there: Gemini, AI Studio and the other Google apps keep the signed-out
 * state they rendered before the import. The bridge therefore asks the module
 * that owns the managed views to reload the views of that partition — once,
 * after a successful import, and only when the set of cookies changed.
 *
 * The module knows nothing about the views: the owner registers a refresher,
 * the same way the broadcast module receives its list reader. That keeps the
 * bridge independent of the WebContentsView manager and testable without one.
 */

import { Logger } from '../../core/logger.js'

/** Reloads the open views of a partition and reports how many it reloaded. */
export type SiteSessionViewRefresher = (partition: string) => number

let refresher: SiteSessionViewRefresher | null = null

/**
 * Registers the owner of the managed views.
 *
 * One owner: the app has one manager of native views. Passing null removes the
 * refresher (shutdown and tests).
 */
export function setSiteSessionViewRefresher(next: SiteSessionViewRefresher | null): void {
  refresher = next
}

/**
 * Reloads the open views of a partition after an import.
 *
 * A missing refresher is not an error: the bridge core is also used outside the
 * running app (tests, the stdio path), and a view that is not reloaded now is
 * still created with the imported cookies later.
 */
export function refreshSiteSessionViews(partition: string): number {
  if (!refresher) return 0
  try {
    return refresher(partition)
  } catch (error) {
    Logger.warn(
      '[SiteSession] The open views of the imported session could not be reloaded:',
      error
    )
    return 0
  }
}
