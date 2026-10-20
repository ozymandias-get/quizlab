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
 * Origin allowlist policy for the native-messaging bridge.
 *
 * PRODUCTION (isDev=false): only the paired extension origin may reach the
 * bridge. The health endpoint hands out the HMAC secret, so no localhost or
 * arbitrary web origin is allowed.
 *
 * DEVELOPMENT (isDev=true): the paired extension origin plus the exact dev
 * server origin (e.g. http://localhost:5173, derived from the Vite config).
 * Matches are exact — "any port" on localhost is never allowed.
 */
export interface BridgeOriginPolicy {
  expectedExtensionOrigin: string | null
  allowedDevOrigins: readonly string[]
  isDev: boolean
}

/**
 * SECURITY: The health endpoint hands out the HMAC secret, so only the
 * paired extension (and, in dev only, the exact configured dev server
 * origin) may reach the bridge. Browsers set the Origin header and a page
 * cannot spoof a chrome-extension:// origin, so exact origin matching closes
 * that hole; HMAC stays as defense in depth for the cookie POST. Local
 * processes can always forge headers, but they can equally read the secret
 * from the app's memory.
 */
export function isAllowedBridgeOrigin(
  origin: string | undefined,
  policy: BridgeOriginPolicy
): boolean {
  if (!origin) return false
  if (policy.expectedExtensionOrigin && origin === policy.expectedExtensionOrigin) {
    return true
  }
  if (!policy.isDev) return false
  return policy.allowedDevOrigins.includes(origin)
}

// The list of domains a cookie may belong to is no longer written down here.
// A packet is checked against the domain list of the site it claims to be
// for, and that list comes from the site registry — see
// `electron/features/web-session/siteSessionCookieRouter.ts`. A hand-written
// list would only be a second thing that can drift from the registry.
