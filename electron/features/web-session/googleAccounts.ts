import type { Session } from 'electron'

import { isSiteSessionSlot } from '../../../shared/constants/siteSessionSlots.js'

const LIST_ACCOUNTS_URL =
  'https://accounts.google.com/ListAccounts?gpsia=1&source=ChromiumBrowser&json=standard'
const cache = new WeakMap<Session, { key: string; expires: number; result: Promise<number[]> }>()

/** Same ListAccounts JSON shape used by Chromium's Gaia account parser. */
export function parseGoogleAccountSlots(body: string): number[] {
  if (body.length > 1_000_000) throw new Error('Google account response too large')
  const data: unknown = JSON.parse(body.replace(/^\s*\)\]\}'[^\n]*\n/, ''))
  if (!Array.isArray(data) || data[0] !== 'gaia.l.a.r' || !Array.isArray(data[1])) {
    throw new Error('Unknown Google account response')
  }
  const slots: number[] = []
  for (const [index, account] of data[1].entries()) {
    if (!Array.isArray(account) || account[0] !== 'gaia.l.a') continue
    if (typeof account[3] !== 'string' || !account[3]) continue
    if (account[9] === 0 || account[14] === 1 || account[15] === 0) continue
    // Keep Google's original positions even when a signed-out entry is skipped.
    if (isSiteSessionSlot(index + 1)) slots.push(index + 1)
  }
  return slots
}

/** Only numeric positions leave main; account names and emails are never retained. */
export async function getGoogleAccountSlots(
  primary: Session,
  importKey: string
): Promise<number[]> {
  if (typeof primary.fetch !== 'function') return [1]
  const previous = cache.get(primary)
  if (previous?.key === importKey && previous.expires > Date.now()) return previous.result
  const entry = { key: importKey, expires: Date.now() + 60_000, result: Promise.resolve([1]) }
  entry.result = (async () => {
    try {
      const response = await primary.fetch(LIST_ACCOUNTS_URL, {
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) throw new Error('Google account lookup failed')
      return parseGoogleAccountSlots(await response.text())
    } catch {
      // Discovery failure must never invent additional accounts from slot history.
      entry.expires = Date.now() + 5000
      return [1]
    }
  })()
  cache.set(primary, entry)
  return entry.result
}
