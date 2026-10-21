/**
 * The cookies that identify the signed-in account of a site.
 *
 * The digest of these cookies is what tells two accounts of the same site
 * apart. Session tokens (`SID`, `*PSIDTS`, …) are deliberately absent: they
 * rotate on every refresh and would make every session look like a new
 * account.
 */
export const SITE_SESSION_IDENTITY_COOKIES = {
  google: ['__Secure-1PSID', '__Secure-3PSID']
} as const satisfies Record<string, readonly string[]>

export function getSiteSessionIdentityCookies(siteId: string): readonly string[] {
  // `Object.hasOwn` keeps prototype-chain ids ('constructor', '__proto__', …)
  // from resolving to `Object.prototype` members: the table is a plain object
  // literal, so a bare lookup would hand back the inherited member instead of
  // an empty list.
  if (!Object.hasOwn(SITE_SESSION_IDENTITY_COOKIES, siteId)) return []
  return SITE_SESSION_IDENTITY_COOKIES[siteId as keyof typeof SITE_SESSION_IDENTITY_COOKIES]
}
