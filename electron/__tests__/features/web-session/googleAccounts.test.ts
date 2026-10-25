import type { Session } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import { googleAccountSlotOptions } from '../../../../shared/constants/siteSessionSlots.js'
import {
  getGoogleAccountSlots,
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

  it('accepts XSSI and preserves indices while excluding signed-out accounts', () => {
    const data = JSON.parse(responseFor(3))
    data[1][1][14] = 1
    expect(parseGoogleAccountSlots(")]}'\n" + JSON.stringify(data))).toEqual([1, 3])
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
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'include' })
  })

  it('never falls back to historical or guessed extra accounts after a network failure', async () => {
    const primary = { fetch: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as Session
    expect(await getGoogleAccountSlots(primary, '')).toEqual([1])
  })
})
