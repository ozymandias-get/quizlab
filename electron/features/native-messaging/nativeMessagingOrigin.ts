import crypto from 'crypto'

// Chrome derives the extension ID from the SHA-256 hash of the manifest's
// DER-encoded public key: the first 16 bytes, hex-encoded (32 chars) and each
// hex digit shifted 0..15 -> 'a'..'p' (components/crx_file/id_util.cc). The
// key is pinned in manifest.json, so the ID is deterministic regardless of
// the load path.
export function deriveExtensionIdFromKey(publicKeyBase64: string): string {
  const hash = crypto.createHash('sha256').update(Buffer.from(publicKeyBase64, 'base64')).digest()
  const hex = hash.subarray(0, 16).toString('hex')
  let id = ''
  for (const ch of hex) {
    id += String.fromCharCode(97 + parseInt(ch, 16))
  }
  return id
}

/**
 * SECURITY: The health endpoint hands out the HMAC secret, so only the
 * paired extension (or the app's own dev/renderer origins on localhost) may
 * reach the bridge. Browsers set the Origin header and a page cannot spoof a
 * chrome-extension:// origin, so origin matching closes that hole; HMAC stays
 * as defense in depth for the cookie POST. Local processes can always forge
 * headers, but they can equally read the secret from the app's memory.
 */
export function isAllowedBridgeOrigin(
  origin: string | undefined,
  expectedExtensionOrigin: string | null
): boolean {
  if (!origin) return false
  if (expectedExtensionOrigin && origin === expectedExtensionOrigin) {
    return true
  }
  try {
    const parsed = new URL(origin)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    }
  } catch {
    return false
  }
  return false
}

const ALLOWED_COOKIE_DOMAINS = ['.google.com', '.youtube.com']

// SECURITY: Only accept cookies from known Google domains so a compromised
// extension cannot inject cookies for arbitrary domains.
export function validateCookieDomains(cookies: { domain?: string }[]): boolean {
  return !cookies.some((c) => {
    if (!c.domain) return true
    const domain = c.domain.startsWith('.') ? c.domain : '.' + c.domain
    return !ALLOWED_COOKIE_DOMAINS.some((d) => domain.endsWith(d))
  })
}
