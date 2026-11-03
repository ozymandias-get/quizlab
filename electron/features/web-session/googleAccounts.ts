import type { Session } from 'electron'

import { isSiteSessionSlot } from '../../../shared/constants/siteSessionSlots.js'

const LIST_ACCOUNTS_URL =
  'https://accounts.google.com/ListAccounts?gpsia=1&source=ChromiumBrowser&json=standard'
const AUTH_COOKIE_NAMES = new Set(['SID', '__Secure-1PSID', '__Secure-3PSID'])

/** One account as Google's session list reports it. */
export interface GoogleAccountEntry {
  /** The position in the list, which is also the /u/<position> index. */
  slot: number
  /** Google's stable account identifier, when the response carries one. */
  accountId: string | null
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

/** Same ListAccounts JSON shape used by Chromium's Gaia account parser. */
export function parseGoogleAccountEntries(body: string): GoogleAccountEntry[] {
  if (body.length > 1_000_000) throw new Error('Google account response too large')
  const data: unknown = JSON.parse(body.replace(/^\s*\)\]\}'[^\n]*\n/, ''))
  if (!Array.isArray(data) || data[0] !== 'gaia.l.a.r' || !Array.isArray(data[1])) {
    throw new Error('Unknown Google account response')
  }
  const entries: GoogleAccountEntry[] = []
  for (const [index, account] of data[1].entries()) {
    if (!Array.isArray(account) || account[0] !== 'gaia.l.a') continue
    if (typeof account[3] !== 'string' || !account[3]) continue
    // Verification is separate from session validity: Google can report a
    // signed-in account as unverified without signing it out.
    if (account[9] === 0 || account[14] === 1) continue
    // Keep Google's original positions even when a signed-out entry is skipped.
    if (!isSiteSessionSlot(index + 1)) continue
    entries.push({
      slot: index + 1,
      accountId: typeof account[10] === 'string' && account[10] ? account[10] : null
    })
  }
  return entries
}

export function parseGoogleAccountSlots(body: string): number[] {
  return parseGoogleAccountEntries(body).map((entry) => entry.slot)
}

/** Drops the discovery cache for a session, e.g. after an auth cookie changed. */
export function invalidateGoogleAccountSlotsCache(primary: Session): void {
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

/**
 * The last known slots without touching the network.
 *
 * `known` is false until a discovery has finished for this import key. A
 * known `null` is an authoritative "Google did not answer", not "no accounts".
 */
export function peekGoogleAccountSlots(
  primary: Session,
  importKey: string
): { known: boolean; slots: number[] | null } {
  const peeked = peekGoogleAccountEntries(primary, importKey)
  return {
    known: peeked.known,
    slots: peeked.entries === null ? null : peeked.entries.map((account) => account.slot)
  }
}

/** Only numeric positions leave main; account names and emails are never retained. */
export async function getGoogleAccountSlots(
  primary: Session,
  importKey: string
): Promise<number[] | null> {
  const entries = await getGoogleAccountEntries(primary, importKey)
  return entries === null ? null : entries.map((entry) => entry.slot)
}

/**
 * The same discovery with Google's stable account ids.
 *
 * The ids stay in the main process; callers only use them to notice that the
 * order of the accounts changed.
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
      const response = await primary.fetch(LIST_ACCOUNTS_URL, {
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
