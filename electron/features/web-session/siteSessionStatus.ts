/**
 * The status of one account of a site, derived from what the app knows.
 *
 * The service calls this once per account: each one has its own switch, its
 * own last import and its own cookie jar, so one row of a site may say
 * "imported" while the next one is signed out. The derivation is a pure
 * function of its input: no clock, no I/O, no hidden state. The settings row
 * renders the code it returns, so the order of the checks is the order of the
 * meaning:
 *
 *   - A switch that is off is the loudest fact: the app will not touch that
 *     account's cookies, no matter what the extension or the last import says.
 *   - An extension that is missing or too old makes every later result
 *     meaningless, so it outranks them.
 *   - Only then does the last import result speak.
 */

import type { SiteSessionStatusCode } from '../../../shared/types/siteSession.js'
import type { SiteSessionAccountState } from './siteSessionMigration.js'

export function deriveSiteSessionStatus(input: {
  enabled: boolean
  extensionConnected: boolean
  extensionVersionOk: boolean
  lastResult: SiteSessionAccountState['lastResult']
  hasLocalSession: boolean
}): SiteSessionStatusCode {
  if (!input.enabled) {
    // The import is off: the session the app holds is either the user's own
    // manual login or nothing at all.
    return input.hasLocalSession ? 'manual_session' : 'signed_out'
  }

  if (!input.extensionConnected) return 'extension_missing'
  if (!input.extensionVersionOk) return 'extension_outdated'

  switch (input.lastResult) {
    case 'permission_missing':
      return 'permission_missing'
    case 'no_cookies':
      return 'no_cookies_in_browser'
    case 'failed':
      return 'import_failed'
    case 'imported':
      return 'imported'
    default:
      // The import is on and the extension is ready, but nothing has been
      // imported yet: the user still has to sign in to the site in Chrome.
      return 'extension_connected'
  }
}
