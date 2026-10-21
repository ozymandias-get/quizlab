/**
 * Which account a session belongs to: the digest of the cookies that identify
 * the account, and the decision that digest feeds.
 *
 * Session tokens rotate on every refresh, so a digest of the whole cookie
 * packet would make every session look like a new account. Only the site's
 * identity cookies (see `SITE_SESSION_IDENTITY_COOKIES`) tell two accounts of
 * the same site apart.
 *
 * Both functions are pure: they read no clock, no disk and no session, so the
 * same input always produces the same answer. The digest carries no salt for
 * the same reason - the next packet is hashed again by a later run of the app,
 * and it has to arrive at the value the account's history already holds.
 */

import { createHash } from 'node:crypto'

import type { ChromeExtensionCookie } from '@shared-core/types'

/** One account a session may belong to, with the digests of its past sessions. */
export interface SiteSessionAccountCandidate {
  accountId: string
  /** The identity digests of the sessions this account has held. */
  fingerprints: readonly string[]
}

/** What a session turned out to be. */
export type SiteSessionAccountMatch =
  { kind: 'matched'; accountId: string } | { kind: 'create' } | { kind: 'ambiguous' }

/**
 * The digest of the cookies that identify the account of a session.
 *
 * Only the cookies whose name is in `identityCookieNames` are read; a packet
 * that carries none of them has no fingerprint at all (`null`), because there
 * is nothing in it that says which account it belongs to.
 *
 * The identity cookies are sorted by name and joined as `name\0value` pairs.
 * The sort keeps the digest of a packet independent of the order the browser
 * reported its cookies in; the NUL separator keeps a name and a value from
 * running into each other, so `ab` + `c` and `a` + `bc` do not digest the
 * same. A value is sorted after its name, so two cookies that share a name
 * (a domain and a host-only copy, say) are ordered by value instead of by the
 * order they arrived in.
 */
export function computeSessionFingerprint(
  cookies: readonly ChromeExtensionCookie[],
  identityCookieNames: readonly string[]
): string | null {
  const names = new Set(identityCookieNames)
  const identity = cookies.filter((cookie) => names.has(cookie.name))
  if (identity.length === 0) return null

  const pairs = identity.map((cookie) => `${cookie.name}\0${cookie.value}`).sort()
  return createHash('sha256').update(pairs.join('\n')).digest('hex')
}

/**
 * The account a session belongs to.
 *
 * A fingerprint that a candidate's history holds is that candidate's session:
 * the history is what tells a repeated login of a known account apart from a
 * new account on the same site.
 *
 * A fingerprint no candidate has seen still has one home - the single
 * candidate that has no fingerprint yet. That account was opened by hand, so
 * its own session never arrived through an import. When there is no such
 * candidate (or more than one) the session is a new account, which the caller
 * has to open.
 *
 * A session without a fingerprint cannot be attributed by its cookies. With a
 * single account open there is nobody else it could belong to, so it goes to
 * that one; with several open the app has to ask the user, because a guess
 * would write the session into another account's cookie jar.
 */
export function matchSiteSessionAccount(input: {
  fingerprint: string | null
  candidates: readonly SiteSessionAccountCandidate[]
}): SiteSessionAccountMatch {
  const { fingerprint, candidates } = input

  if (fingerprint === null) {
    if (candidates.length !== 1) return { kind: 'ambiguous' }
    const [only] = candidates
    return { kind: 'matched', accountId: only.accountId }
  }

  const known = candidates.find((candidate) => candidate.fingerprints.includes(fingerprint))
  if (known) return { kind: 'matched', accountId: known.accountId }

  const unseen = candidates.filter((candidate) => candidate.fingerprints.length === 0)
  if (unseen.length !== 1) return { kind: 'create' }

  const [onlyUnseen] = unseen
  return { kind: 'matched', accountId: onlyUnseen.accountId }
}
