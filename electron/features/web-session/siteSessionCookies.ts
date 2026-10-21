/**
 * The cookie rules of the per-site session import.
 *
 * One rule decides what belongs to a site: a cookie domain belongs to the
 * site that owns the allowed domain list when it is that domain itself or a
 * subdomain of it. The writer of a session (the importer), the reader of one
 * (the router) and the eraser of one (the wipe) all have to agree on it, so
 * the rule lives here — once — and the three of them import it.
 *
 * The rules are pure: they read no clock, no disk and no session.
 */

/**
 * The host of a domain: the leading dots of a domain-wide cookie are dropped.
 */
export function domainHost(domain: string): string {
  return domain.replace(/^\.+/, '')
}

/**
 * The domain of a cookie in its comparable form: trimmed and lowercased.
 *
 * The leading dot survives, because it is what tells a domain-wide cookie
 * apart from a host-only one — the payload builder needs that difference.
 */
export function normalizeCookieDomain(domain: string | null | undefined): string | null {
  if (typeof domain !== 'string') return null
  const normalized = domain.trim().toLowerCase()
  return normalized || null
}

/**
 * Whether a cookie domain belongs to the site that owns `allowedDomains`.
 *
 * A domain belongs when it is the allowed domain itself or a subdomain of it:
 * `.chatgpt.com` allows `chatgpt.com` and `mail.chatgpt.com`, but never
 * `notchatgpt.com` or `chatgpt.com.evil.com`.
 */
export function isCookieDomainAllowed(
  domain: string | null | undefined,
  allowedDomains: readonly string[]
): boolean {
  const normalized = normalizeCookieDomain(domain)
  if (!normalized) return false
  const host = domainHost(normalized)
  if (!host) return false

  return allowedDomains.some((allowed) => {
    const allowedHost = domainHost(normalizeCookieDomain(allowed) ?? '')
    if (!allowedHost) return false
    return host === allowedHost || host.endsWith(`.${allowedHost}`)
  })
}

/**
 * The URLs a cookie of this domain and path may be stored under.
 *
 * A secure cookie only ever lives under https; a plain one is looked up under
 * both schemes, because the browser may have stored it either way.
 */
export function cookieRemovalUrls(
  domain: string | null | undefined,
  path: string | undefined,
  secure: boolean | undefined
): string[] {
  const normalized = normalizeCookieDomain(domain)
  if (!normalized) return []
  const host = domainHost(normalized)
  if (!host) return []

  const cookiePath = path || '/'
  const schemes = secure ? ['https'] : ['https', 'http']
  return schemes.map((scheme) => `${scheme}://${host}${cookiePath}`)
}
