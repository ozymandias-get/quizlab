import { isIP } from 'node:net'

const PRIVATE_IP_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  { start: '127.0.0.0', end: '127.255.255.255' },
  { start: '169.254.0.0', end: '169.254.255.255' },
  { start: '0.0.0.0', end: '0.255.255.255' },
  { start: '100.64.0.0', end: '100.127.255.255' },
  { start: '198.18.0.0', end: '198.19.255.255' }
]

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/

const ipToInt = (ip: string): number => {
  const parts = ip.split('.').map(Number)
  return (
    ((parts[0] || 0) << 24) | ((parts[1] || 0) << 16) | ((parts[2] || 0) << 8) | (parts[3] || 0)
  )
}

function isPrivateIPv4(ip: string): boolean {
  if (!IPV4_RE.test(ip)) return false
  const ipInt = ipToInt(ip)
  return PRIVATE_IP_RANGES.some(({ start, end }) => {
    return ipInt >= ipToInt(start) && ipInt <= ipToInt(end)
  })
}

/**
 * Expands an IPv6 address (with or without brackets) into its 8 full lowercase
 * hextets. An embedded IPv4 tail ("::ffff:127.0.0.1") is converted to its two
 * hextets first. Returns null when the input is not a valid IPv6 address.
 */
function expandIPv6(host: string): string[] | null {
  let address = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
  if (isIP(address) !== 6) return null
  address = address.toLowerCase()

  const v4Tail = address.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (v4Tail) {
    const hextets = v4Tail[1].split('.').map((octet) => {
      return Number(octet).toString(16).padStart(2, '0')
    })
    address = `${address.slice(0, v4Tail.index)}${hextets[0]}${hextets[1]}:${hextets[2]}${hextets[3]}`
  }

  const halves = address.split('::')
  if (halves.length === 1) {
    const groups = halves[0].split(':')
    if (groups.length !== 8) return null
    return groups.map((group) => group.padStart(4, '0'))
  }
  if (halves.length !== 2) return null

  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const missing = 8 - left.length - right.length
  if (missing < 1) return null
  return [
    ...left.map((group) => group.padStart(4, '0')),
    ...Array.from({ length: missing }, () => '0000'),
    ...right.map((group) => group.padStart(4, '0'))
  ]
}

function isPrivateIPv6(host: string): boolean {
  const groups = expandIPv6(host)
  if (!groups) return false

  // :: (unspecified) and ::1 (loopback)
  if (groups.every((group) => group === '0000')) return true
  if (groups.slice(0, 7).every((group) => group === '0000') && groups[7] === '0001') return true

  // IPv4-compatible (::a.b.c.d) and IPv4-mapped (::ffff:a.b.c.d) forms embed a
  // dotted-quad address in the last 32 bits; run it through the IPv4 checks so
  // ::ffff:127.0.0.1 / ::ffff:169.254.169.254 cannot sneak past the block.
  const compatible = groups.slice(0, 6).every((group) => group === '0000')
  const mapped = groups.slice(0, 5).every((group) => group === '0000') && groups[5] === 'ffff'
  if (compatible || mapped) {
    const embeddedV4 = [
      Number.parseInt(groups[6].slice(0, 2), 16),
      Number.parseInt(groups[6].slice(2, 4), 16),
      Number.parseInt(groups[7].slice(0, 2), 16),
      Number.parseInt(groups[7].slice(2, 4), 16)
    ].join('.')
    if (isPrivateIPv4(embeddedV4)) return true
  }

  const first = Number.parseInt(groups[0], 16)
  const second = Number.parseInt(groups[1], 16)
  // Link-local fe80::/10 (e.g. fe80::1)
  if (first >= 0xfe80 && first <= 0xfebf) return true
  // Unique local addresses fc00::/7
  if (first >= 0xfc00 && first <= 0xfdff) return true
  // Multicast ff00::/8
  if ((first & 0xff00) === 0xff00) return true
  // Documentation 2001:db8::/32
  if (first === 0x2001 && second === 0x0db8) return true
  // 6to4 (2002::/16) and Teredo (2001:0000::/32) can tunnel to private IPv4
  if (first === 0x2002) return true
  if (first === 0x2001 && second === 0x0000) return true

  return false
}

/**
 * Normalizes a URL hostname for security checks: strips IPv6 brackets and a
 * single trailing root dot ("localhost." and "[::1]" are the same destinations
 * as "localhost" and "::1", so they must be checked identically).
 */
function normalizeHostname(hostname: string): string {
  let host = hostname.toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1)
  }
  if (host.endsWith('.') && !host.endsWith('..')) {
    host = host.slice(0, -1)
  }
  return host
}

const isLoopbackOrPrivateHost = (hostname: string): boolean => {
  const host = normalizeHostname(hostname)

  if (host === 'localhost') return true

  if (isIP(host) === 4) return isPrivateIPv4(host)
  if (isIP(host) === 6) return isPrivateIPv6(host)

  // Single-label hostnames ("internal", the DNS root ".") can only resolve on
  // local/private namespaces — treat them as private.
  if (!host.includes('.')) return true

  return false
}

function validateProviderUrl(baseUrl: string): string | null {
  if (typeof baseUrl !== 'string' || !baseUrl) return 'Missing baseUrl'
  try {
    const parsed = new URL(baseUrl)
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return `Unsupported protocol: ${parsed.protocol}`
    }

    // Reject userinfo ("user:pass@host"): credentials are never needed in a
    // provider config and "user@127.0.0.1@evil.com"-style tricks only add
    // parsing confusion on top of the host checks below.
    if (parsed.username !== '' || parsed.password !== '') {
      return 'Credentials in provider URLs are not allowed'
    }

    const host = normalizeHostname(parsed.hostname)
    const isLocalDevHost = host === 'localhost' || host === '127.0.0.1'

    if (parsed.protocol !== 'https:' && !isLocalDevHost) {
      return 'Non-HTTPS provider URLs are only allowed for localhost'
    }

    // Skip SSRF block for localhost/127.0.0.1 since they are already
    // handled above — HTTP is explicitly allowed for local development.
    if (!isLocalDevHost && isLoopbackOrPrivateHost(host)) {
      return `SSRF blocked: "${host}" is a private/reserved address`
    }

    return null
  } catch {
    return 'Invalid URL'
  }
}

const MAX_REDIRECTS = 5

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

/**
 * Applies Fetch-spec redirect method semantics for the follow-up request:
 * 301/302/303 convert non-GET/HEAD methods to GET and drop the body,
 * while 307/308 preserve method and body.
 */
function applyRedirectSemantics(status: number, init?: RequestInit): RequestInit | undefined {
  if (!init || status === 307 || status === 308) return init
  const method = (init.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return init
  const headers = new Headers(init.headers)
  headers.delete('Content-Type')
  headers.delete('Content-Length')
  const next: RequestInit = { ...init, method: 'GET', headers }
  delete next.body
  return next
}

/**
 * fetch() wrapper that re-validates every redirect hop with the same SSRF
 * rules as the original URL. The default fetch() follows redirects blindly,
 * so a public provider URL that answers with a 302 to an internal address
 * (e.g. 169.254.169.254) would otherwise bypass the block entirely.
 *
 * Redirects may only stay on the origin of the original request; any
 * cross-origin hop is rejected so credentials (Authorization, Cookie,
 * Proxy-Authorization, ...) are never forwarded to another domain.
 */
async function fetchWithSsrProtection(url: string, init?: RequestInit): Promise<Response> {
  const originalOrigin = new URL(url).origin
  let currentUrl = url
  let currentInit = init
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(currentUrl, { ...currentInit, redirect: 'manual' })
    if (!isRedirectStatus(response.status)) return response
    const location = response.headers.get('location')
    if (!location) return response
    const target = new URL(location, currentUrl)
    const err = validateProviderUrl(target.href)
    if (err) {
      throw new Error(`SSRF blocked on redirect: ${err}`)
    }
    if (target.origin !== originalOrigin) {
      throw new Error(`Cross-origin redirect blocked: "${target.href}"`)
    }
    currentUrl = target.href
    currentInit = applyRedirectSemantics(response.status, currentInit)
  }
  throw new Error('Too many redirects')
}

export { fetchWithSsrProtection, validateProviderUrl }
export type {} // satisfy isolatedModules
