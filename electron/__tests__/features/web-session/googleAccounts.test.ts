import type { Session } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import { googleAccountSlotOptions } from '../../../../shared/constants/siteSessionSlots.js'
import {
  getGoogleAccountSlots,
  parseGoogleAccountEntries,
  parseGoogleAccountSlots
} from '../../../features/web-session/googleAccounts.js'

function responseFor(count: number) {
  return JSON.stringify([
    'gaia.l.a.r',
    Array.from({ length: count }, (_, index) => [
      'gaia.l.a',
      1,
      '',
      `test${index}@example.test`,
      '',
      1,
      1,
      0,
      0,
      1,
      `id-${index}`
    ])
  ])
}

describe('Google account discovery', () => {
  it('returns exactly two accounts without inventing the next slot', () => {
    expect(parseGoogleAccountSlots(responseFor(2))).toEqual([1, 2])
    expect(googleAccountSlotOptions([1, 2, 2])).toEqual([1, 2])
    expect(googleAccountSlotOptions()).toEqual([])
  })

  it('carries the account email for the local display label', () => {
    expect(parseGoogleAccountEntries(responseFor(2))).toEqual([
      { slot: 1, accountId: 'id-0', email: 'test0@example.test' },
      { slot: 2, accountId: 'id-1', email: 'test1@example.test' }
    ])
  })

  it('drops a display email that exceeds the bounded length', () => {
    const data = JSON.parse(responseFor(1))
    data[1][0][3] = 'a'.repeat(200) + '@example.test'
    expect(parseGoogleAccountEntries(JSON.stringify(data))).toEqual([
      { slot: 1, accountId: 'id-0', email: undefined }
    ])
  })

  it('accepts XSSI and preserves indices while excluding signed-out accounts', () => {
    const data = JSON.parse(responseFor(3))
    data[1][1][14] = 1
    expect(parseGoogleAccountSlots(")]}'\n" + JSON.stringify(data))).toEqual([1, 3])
  })

  it('keeps signed-in accounts when Google reports them as unverified', () => {
    const data = JSON.parse(responseFor(2))
    data[1][1][15] = 0
    expect(parseGoogleAccountSlots(JSON.stringify(data))).toEqual([1, 2])
  })

  it('drops entries Google does not treat as valid list members', () => {
    // Field 9 is separate from the verification flags: a zero there means the
    // entry may not hold a session at all, so the slot must not be offered.
    const data = JSON.parse(responseFor(2))
    data[1][1][9] = 0
    expect(parseGoogleAccountSlots(JSON.stringify(data))).toEqual([1])
  })

  it('does not interpret malformed or unrelated JSON as a list of accounts', () => {
    expect(() => parseGoogleAccountSlots('{}')).toThrow()
    expect(() => parseGoogleAccountSlots('<html>Sign in</html>')).toThrow()
    expect(parseGoogleAccountSlots(responseFor(0))).toEqual([])
  })

  it('caches real results and discovers a third account only after the imported session changes', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => responseFor(2) })
    const primary = { fetch } as unknown as Session
    expect(await getGoogleAccountSlots(primary, 'import-1')).toEqual([1, 2])
    expect(await getGoogleAccountSlots(primary, 'import-1')).toEqual([1, 2])
    expect(fetch).toHaveBeenCalledTimes(1)
    fetch.mockResolvedValue({ ok: true, text: async () => responseFor(3) })
    expect(await getGoogleAccountSlots(primary, 'import-2')).toEqual([1, 2, 3])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' })
  })

  it('never falls back to historical or guessed extra accounts after a network failure', async () => {
    const primary = { fetch: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as Session
    expect(await getGoogleAccountSlots(primary, '')).toBeNull()
  })

  it('drops the discovery cache when a Google auth cookie changes', async () => {
    let listener: ((event: unknown, cookie: Electron.Cookie) => void) | undefined
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => responseFor(2) })
    const primary = {
      fetch,
      cookies: {
        on: vi.fn((_event: string, callback: typeof listener) => {
          listener = callback
        })
      }
    } as unknown as Session

    expect(await getGoogleAccountSlots(primary, 'import-1')).toEqual([1, 2])
    expect(await getGoogleAccountSlots(primary, 'import-1')).toEqual([1, 2])
    expect(fetch).toHaveBeenCalledTimes(1)

    listener?.({}, { name: 'SID', domain: '.google.com' } as Electron.Cookie)
    expect(await getGoogleAccountSlots(primary, 'import-1')).toEqual([1, 2])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('drops the discovery cache also when a web sign-in cookie changes', async () => {
    let listener: ((event: unknown, cookie: Electron.Cookie) => void) | undefined
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => responseFor(2) })
    const primary = {
      fetch,
      cookies: {
        on: vi.fn((_event: string, callback: typeof listener) => {
          listener = callback
        })
      }
    } as unknown as Session

    expect(await getGoogleAccountSlots(primary, 'import-1')).toEqual([1, 2])
    expect(fetch).toHaveBeenCalledTimes(1)

    // A sign-in that happens inside the app (not through an import) writes the
    // LSID cookie on accounts.google.com; the list must not go stale on it.
    listener?.({}, { name: 'LSID', domain: 'accounts.google.com' } as Electron.Cookie)
    expect(await getGoogleAccountSlots(primary, 'import-1')).toEqual([1, 2])
    expect(fetch).toHaveBeenCalledTimes(2)

    // A rotating, non-auth cookie must not drop the cache.
    listener?.({}, { name: '__Secure-1PSIDTS', domain: '.google.com' } as Electron.Cookie)
    expect(await getGoogleAccountSlots(primary, 'import-1')).toEqual([1, 2])
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
