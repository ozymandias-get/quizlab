import { describe, expect, it } from 'vitest'

import type { ChromeExtensionCookie } from '../../../../shared/types/index.js'
import {
  computeSessionFingerprint,
  matchSiteSessionAccount
} from '../../../features/web-session/siteSessionFingerprint.js'

describe('computeSessionFingerprint', () => {
  const cookie = (name: string, value: string) =>
    ({
      name,
      value,
      domain: '.google.com',
      path: '/',
      secure: true,
      httpOnly: true
    }) as ChromeExtensionCookie

  it('digests the identity cookies and ignores the others', () => {
    const a = computeSessionFingerprint(
      [cookie('__Secure-1PSID', 'x'), cookie('NID', 'y')],
      ['__Secure-1PSID']
    )
    const b = computeSessionFingerprint(
      [cookie('__Secure-1PSID', 'x'), cookie('NID', 'z')],
      ['__Secure-1PSID']
    )
    expect(a).not.toBeNull()
    expect(a).toBe(b)
  })

  it('is null when the site has no identity cookie in the packet', () => {
    expect(computeSessionFingerprint([cookie('NID', 'y')], ['__Secure-1PSID'])).toBeNull()
    expect(computeSessionFingerprint([cookie('NID', 'y')], [])).toBeNull()
  })

  it('changes when the identity cookie changes', () => {
    const a = computeSessionFingerprint([cookie('__Secure-1PSID', 'x')], ['__Secure-1PSID'])
    const b = computeSessionFingerprint([cookie('__Secure-1PSID', 'w')], ['__Secure-1PSID'])
    expect(a).not.toBe(b)
  })
})

describe('matchSiteSessionAccount', () => {
  it('matches the account whose history holds the fingerprint', () => {
    expect(
      matchSiteSessionAccount({
        fingerprint: 'fp',
        candidates: [{ accountId: 'a', fingerprints: ['fp'] }]
      })
    ).toEqual({ kind: 'matched', accountId: 'a' })
  })

  it('matches the only candidate without a fingerprint when nothing matches', () => {
    expect(
      matchSiteSessionAccount({
        fingerprint: 'fp',
        candidates: [{ accountId: 'a', fingerprints: [] }]
      })
    ).toEqual({ kind: 'matched', accountId: 'a' })
  })

  it('asks for a new account when no candidate can take the session', () => {
    expect(
      matchSiteSessionAccount({
        fingerprint: 'fp',
        candidates: [{ accountId: 'a', fingerprints: ['other'] }]
      })
    ).toEqual({ kind: 'create' })
  })

  it('asks the user when the session has no fingerprint and several candidates are open', () => {
    expect(
      matchSiteSessionAccount({
        fingerprint: null,
        candidates: [
          { accountId: 'a', fingerprints: [] },
          { accountId: 'b', fingerprints: [] }
        ]
      })
    ).toEqual({ kind: 'ambiguous' })
  })

  it('gives the session to the only candidate when the session has no fingerprint', () => {
    expect(
      matchSiteSessionAccount({
        fingerprint: null,
        candidates: [{ accountId: 'a', fingerprints: ['x'] }]
      })
    ).toEqual({ kind: 'matched', accountId: 'a' })
  })
})
