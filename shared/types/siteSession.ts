/**
 * Wire contract for the per-site Chrome session import.
 *
 * The renderer sees a *view* per site: a label key, the hostname, whether the
 * site shares the user's Chrome session and the status of the last import.
 * The main process owns the partition a site lives in and the cookie domains
 * that may travel between Chrome and the app, so those never appear in a
 * renderer-facing type - only in `SiteSessionTarget`, which is main-process
 * only.
 */

/** Where a site comes from: a built-in platform, the Google family, or a user-added site. */
export type SiteSessionKind = 'builtin' | 'google' | 'custom'

export type SiteSessionStatusCode =
  | 'extension_missing'
  | 'extension_outdated'
  | 'extension_connected'
  | 'permission_missing'
  | 'no_cookies_in_browser'
  | 'imported'
  | 'import_failed'
  | 'manual_session'
  | 'signed_out'

/** One row of the settings list: everything the renderer needs to draw a site. */
export interface SiteSessionView {
  siteId: string
  /** i18n key of the site label, resolved by the renderer. */
  labelKey: string
  hostname: string
  kind: SiteSessionKind
  /** The AI app ids that belong to this site. */
  memberAppIds: string[]
  enabled: boolean
  status: SiteSessionStatusCode
  /** ISO timestamp of the last successful import, or null. */
  importedAt: string | null
  lastError: string | null
}

/**
 * Main-process routing target for one site.
 *
 * `partition` names the `WebContentsView` session partition the imported
 * cookies are written into; it is main-process state and must never reach the
 * renderer.
 */
export interface SiteSessionTarget {
  siteId: string
  hostname: string
  partition: string
  /** The cookie domains that may be transferred for this site. */
  cookieDomains: readonly string[]
}

/** Payload of the list invoke and of the change event. */
export interface SiteSessionListResult {
  views: SiteSessionView[]
  /** Whether the Chrome extension is currently connected to the app. */
  extensionConnected: boolean
  /** Whether the connected extension is new enough to be used. */
  extensionVersionOk: boolean
}

/**
 * The outcome of an action on one site's session.
 *
 * `error` is a stable code that the renderer can translate. Every code the
 * app can produce:
 *
 *   - `unknown_target`: the app does not know the site the action was for
 *   - `write_failed`: the switch could not be written; nothing else happened
 *   - `wipe_failed`: the session could not be cleared; the switch was not touched
 *   - `switch_off_wipe_failed`: the switch was written, the session could not
 *     be cleared — `detail` says so
 *   - `invalid_site_id`: the site id was not a string
 *   - `invalid_enabled`: the switch was not a boolean
 *   - `Unauthorized`: the request did not come from the trusted window
 */
export interface SiteSessionActionResult {
  success: boolean
  error?: string
  /** A human readable note about a failure that happened partly. */
  detail?: string
}
