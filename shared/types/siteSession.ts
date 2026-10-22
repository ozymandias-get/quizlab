/**
 * Wire contract for the per-site Chrome session import.
 *
 * The renderer sees a *view* per site: a label key, the hostname, whether the
 * site shares the user's Chrome session and the status of the last import.
 * The main process owns the partition a site lives in and the cookie domains
 * that may travel between Chrome and the app, so those never appear in a
 * renderer-facing type - only in `SiteSessionTarget`, which is main-process
 * only.
 *
 * A site may hold several accounts at once, each in its own cookie jar. The
 * account views describe that model. The old site-level row
 * (`SiteSessionView`) stays next to them until the settings list reads the
 * accounts instead of the sites.
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

/** The id of the account every site owns: the one on the platform's own partition. */
export const PRIMARY_ACCOUNT_ID = 'primary'

/** One account of a site: what the renderer needs to draw a row of it. */
export interface SiteSessionAccountView {
  accountId: string
  /** The user's name for the account; null while it has none. */
  name: string | null
  /** The 1-based position of the account in its site. The primary account is 1. */
  index: number
  enabled: boolean
  status: SiteSessionStatusCode
  importedAt: string | null
  lastError: string | null
  isActive: boolean
  isPrimary: boolean
}

/** One site with the accounts it holds. */
export interface SiteSessionSiteView {
  siteId: string
  labelKey: string
  hostname: string
  kind: SiteSessionKind
  memberAppIds: string[]
  accounts: SiteSessionAccountView[]
  activeAccountId: string | null
  /** True when a session arrived that could not be attributed to an account. */
  hasPendingSession: boolean
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
  /**
   * The origins whose storage belongs to this site.
   *
   * A site may live on more than one origin: the Google group is four apps on
   * four hosts, and a wipe has to clear the storage of every one of them.
   * Electron's storage filter matches an origin exactly, so a host that is not
   * listed here keeps its data.
   */
  origins: readonly string[]
  partition: string
  /** The cookie domains that may be transferred for this site. */
  cookieDomains: readonly string[]
}

/** Payload of the list invoke and of the change event. */
export interface SiteSessionListResult {
  /**
   * The site-level summary the settings list used before the accounts.
   *
   * It stays until the settings list moves to the accounts (Task 9). Every
   * value in it describes the site's **primary** account, so the old switch
   * and the old switch action keep meaning the same thing.
   */
  views: SiteSessionView[]
  /** The accounts of every site, one row per account and cookie jar. */
  accountViews: SiteSessionSiteView[]
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
 *   - `unknown_target`: the app does not know the site or the account the
 *     action was for, or the site holds no pending session to resolve
 *   - `write_failed`: the setting could not be written; nothing else happened
 *   - `wipe_failed`: the session could not be cleared; the switch was not touched
 *   - `switch_off_wipe_failed`: the switch was written, the session could not
 *     be cleared — `detail` says so
 *   - `primary_account`: the primary account cannot be deleted
 *   - `duplicate_name`: another account of the same site already has that name
 *   - `import_failed`: the pending session could not be written into an account
 *   - `invalid_arguments`: an id was empty or not a string, a name was longer
 *     than 64 characters, or the switch was not a boolean
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
