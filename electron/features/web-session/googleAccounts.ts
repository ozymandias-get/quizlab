import type { Session } from 'electron'

import { isSiteSessionSlot } from '../../../shared/constants/siteSessionSlots.js'

const LIST_ACCOUNTS_URL =
  'https://accounts.google.com/ListAccounts?gpsia=1&source=ChromiumBrowser&json=standard'
/**
 * The cookies a Google sign-in in this app writes.
 *
 * The SID variants are the accepted ones and the PSIDTS twins rotate on their
 * own schedule, so they are deliberately not here: watching them would drop
 * the cache on every refresh without telling it anything new. The LSID and
 * __Host-*SID cookies are what a sign-in or an added account leaves behind on
 * accounts.google.com and *.google.com, which the SID set alone can miss.
 */
const AUTH_COOKIE_NAMES = new Set([
  'SID',
  '__Secure-1PSID',
  '__Secure-3PSID',
  '__Host-1PLSID',
  '__Host-3PLSID',
  'LSID'
])

/** One account as Google's session list reports it. */
export interface GoogleAccountEntry {
  /** The position in the list, which is also the /u/<position> index. */
  slot: number
  /** Google's stable account identifier, when the response carries one. */
  accountId: string | null
  /**
   * The account email, for local UI display only.
   *
   * It may leave the main process inside a site-session view so the account
   * selector labels its slots, but it is never persisted or logged. Absent
   * when the list carries nothing worth rendering.
   */
  email?: string
}

const cache = new WeakMap<
  Session,
  { key: string; expires: number; result: Promise<GoogleAccountEntry[] | null> }
>()
/**
 * The last answer a discovery produced, kept apart from the short-lived cache.
 *
 * The list view must not wait for a network lookup every time it opens. It
 * reads this snapshot immediately and lets a background refresh replace it.
 * A `null` snapshot is an authoritative "Google did not answer", not "no
 * accounts".
 */
const lastKnown = new WeakMap<Session, { key: string; entries: GoogleAccountEntry[] | null }>()
/** Sessions whose auth-cookie changes already invalidate the cache. */
const watchedSessions = new WeakSet<Session>()

/**
 * ListAccounts entry fields, per Chromium's Gaia account parser.
 *
 * The layout is undocumented: these positions are how Google actually answers
 * and how Chromium reads the same response, so they are named once here rather
 * than guessed at array literals throughout the parser.
 */
const ACCOUNT_EMAIL_INDEX = 3
/** `0` when Google does not treat the entry as a valid list member. */
const ACCOUNT_VALID_INDEX = 9
/** Google's stable account identifier, present for most signed-in entries. */
const ACCOUNT_GAIA_INDEX = 10
/** `1` marks an entry that only remembers a signed-out account. */
const ACCOUNT_SIGNED_OUT_INDEX = 14
/** A display email is bounded so a malformed list cannot bloat the view. */
const ACCOUNT_EMAIL_MAX_LENGTH = 128

/** Same ListAccounts JSON shape used by Chromium's Gaia account parser. */
/** Same entries as the discovery, exposed for tests and future callers. */
export function parseGoogleAccountEntries(body: string): GoogleAccountEntry[] {
  if (body.length > 1_000_000) throw new Error('Google account response too large')
  const data: unknown = JSON.parse(body.replace(/^\s*\)\]\}'[^\n]*\n/, ''))
  if (!Array.isArray(data) || data[0] !== 'gaia.l.a.r' || !Array.isArray(data[1])) {
    throw new Error('Unknown Google account response')
  }
  const entries: GoogleAccountEntry[] = []
  for (const [index, account] of data[1].entries()) {
    if (!Array.isArray(account) || account[0] !== 'gaia.l.a') continue
    const rawEmail = account[ACCOUNT_EMAIL_INDEX]
    if (typeof rawEmail !== 'string' || !rawEmail) continue
    // A Gaia entry carries two independent booleans: validity (whether the
    // entry may hold a session at all) and verification. Verification is
    // separate from session validity — Google can report a signed-in account
    // as unverified without signing it out — so only validity is filtered on
    // here, alongside the explicit signed-out marker.
    if (account[ACCOUNT_VALID_INDEX] === 0 || account[ACCOUNT_SIGNED_OUT_INDEX] === 1) continue
    // Keep Google's original positions even when a signed-out entry is skipped.
    if (!isSiteSessionSlot(index + 1)) continue
    const gaia = account[ACCOUNT_GAIA_INDEX]
    entries.push({
      slot: index + 1,
      accountId: typeof gaia === 'string' && gaia ? gaia : null,
      email: rawEmail.length <= ACCOUNT_EMAIL_MAX_LENGTH ? rawEmail : undefined
    })
  }
  return entries
}

export function parseGoogleAccountSlots(body: string): number[] {
  return parseGoogleAccountEntries(body).map((entry) => entry.slot)
}

/** Drops the discovery cache for a session, e.g. after an auth cookie changed. */
function invalidateGoogleAccountSlotsCache(primary: Session): void {
  cache.delete(primary)
  lastKnown.delete(primary)
}

/**
 * Watches the primary Google session's auth cookies.
 *
 * A sign-in or sign-out inside the app changes the account list without
 * changing the config key the cache is keyed by. The cookie event is the
 * signal that the cached positions may now point at other accounts. The
 * periodic refresh stays in place for changes that happen on Google's side.
 */
function watchAuthCookieChanges(primary: Session): void {
  if (watchedSessions.has(primary)) return
  watchedSessions.add(primary)
  try {
    if (!primary.cookies || typeof primary.cookies.on !== 'function') return
    primary.cookies.on('changed', (_event: unknown, cookie: Electron.Cookie | undefined) => {
      if (!cookie || !AUTH_COOKIE_NAMES.has(cookie.name)) return
      const host = (cookie.domain ?? '').replace(/^\.+/, '').toLowerCase()
      if (host !== 'google.com' && !host.endsWith('.google.com')) return
      invalidateGoogleAccountSlotsCache(primary)
    })
  } catch {
    // A session double without the event API simply keeps the periodic refresh.
  }
}

/**
 * The last known account entries without touching the network.
 *
 * `known` is false until a discovery has finished for this import key. A
 * known `null` is an authoritative "Google did not answer", not "no accounts".
 */
export function peekGoogleAccountEntries(
  primary: Session,
  importKey: string
): { known: boolean; entries: GoogleAccountEntry[] | null } {
  watchAuthCookieChanges(primary)
  const entry = lastKnown.get(primary)
  if (!entry || entry.key !== importKey) return { known: false, entries: null }
  return {
    known: true,
    entries: entry.entries === null ? null : entry.entries.map((account) => ({ ...account }))
  }
}

/** Compact list for callers that only need positions; see the entries variant. */
export async function getGoogleAccountSlots(
  primary: Session,
  importKey: string
): Promise<number[] | null> {
  const entries = await getGoogleAccountEntries(primary, importKey)
  return entries === null ? null : entries.map((entry) => entry.slot)
}

/**
 * The same discovery with Google's stable account ids and display emails.
 *
 * The ids stay in the main process; callers use them to notice that the order
 * of the accounts changed. The email may leave it only inside a
 * site-session view, as the account selector's label — see
 * `GoogleAccountEntry.email`.
 */
export async function getGoogleAccountEntries(
  primary: Session,
  importKey: string
): Promise<GoogleAccountEntry[] | null> {
  watchAuthCookieChanges(primary)
  if (typeof primary.fetch !== 'function') {
    lastKnown.set(primary, { key: importKey, entries: null })
    return null
  }
  const previous = cache.get(primary)
  if (previous?.key === importKey && previous.expires > Date.now()) return previous.result
  const entry: {
    key: string
    expires: number
    result: Promise<GoogleAccountEntry[] | null>
  } = {
    key: importKey,
    expires: Date.now() + 60_000,
    result: Promise.resolve(null)
  }
  entry.result = (async () => {
    let entries: GoogleAccountEntry[] | null = null
    try {
      // Google's ListAccounts endpoint answers a GET with HTTP 400 and an HTML
      // error page, so every lookup used to fail and the list fell back to
      // "unverified". Chromium issues the same request as a POST; matching it
      // is what makes the JSON account list come back.
      const response = await primary.fetch(LIST_ACCOUNTS_URL, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) throw new Error('Google account lookup failed')
      entries = parseGoogleAccountEntries(await response.text())
    } catch {
      // Unknown is distinct from an authoritative empty response.
      entry.expires = Date.now() + 5000
      entries = null
    }
    lastKnown.set(primary, { key: importKey, entries })
    return entries
  })()
  cache.set(primary, entry)
  return entry.result
}
