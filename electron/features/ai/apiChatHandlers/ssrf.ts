import type { LookupAddress } from 'node:dns'
import { lookup as dnsLookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'

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

// ─────────────────────────────────────────────────────────────────────────────
// DNS rebinding (TOCTOU) protection
//
// A naive check resolves the hostname, verifies the IP is public, and then
// lets the HTTP client resolve the hostname AGAIN. A malicious DNS server can
// answer the first query with a public IP and the second with 127.0.0.1
// (DNS rebinding), silently reaching local services.
//
// Instead we resolve the hostname ONCE, validate every returned address, and
// pin the validated address at the socket level via a custom `lookup`
// function. The HTTP/TLS layer keeps the ORIGINAL hostname in the Host header
// (and SNI), so the destination IP is the checked one while the server still
// sees the real domain — the standard SSRF-safe connection pattern.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RESPONSE_BODY_BYTES = 50 * 1024 * 1024 // 50 MB

async function resolvePinnedIp(hostname: string): Promise<{ ip: string; family: number }> {
  const host = normalizeHostname(hostname)

  // IP literals need no resolution — the address is already checked by
  // validateProviderUrl before we get here.
  if (isIP(host) === 4) return { ip: host, family: 4 }
  if (isIP(host) === 6) return { ip: host, family: 6 }

  // "localhost" is the explicitly allowed local-development host; resolve it
  // deterministically instead of trusting the system resolver (which can be
  // redirected by /etc/hosts shenanigans on Windows/macOS to any address).
  if (host === 'localhost') return { ip: '127.0.0.1', family: 4 }

  let addresses: LookupAddress[]
  try {
    addresses = await dnsLookup(host, { all: true, verbatim: true })
  } catch {
    throw new Error(`DNS resolution failed for "${hostname}"`)
  }

  if (addresses.length === 0) {
    throw new Error(`DNS resolution failed for "${hostname}"`)
  }

  // EVERY returned address must be public. If any single A/AAAA record points
  // into a private/reserved block the whole request is rejected — a rebinding
  // DNS server cannot smuggle a local address in a parallel record.
  for (const address of addresses) {
    if (isLoopbackOrPrivateHost(address.address)) {
      throw new Error(
        `SSRF blocked: "${hostname}" resolved to private/reserved address ${address.address}`
      )
    }
  }

  const chosen = addresses[0]
  return { ip: chosen.address, family: chosen.family }
}

/**
 * Single HTTP(S) request whose socket is pinned to the pre-validated IP.
 * The Host header / TLS SNI keep the original hostname (Node derives them
 * from the URL object); only the connection target is the checked address.
 */
function pinnedRequest(
  targetUrl: string,
  init: { method: string; headers: Headers; body?: string | null },
  pinnedIp: string,
  pinnedFamily: number,
  signal?: AbortSignal | null
): Promise<{
  status: number
  statusText: string
  headers: Record<string, string | string[] | undefined>
  body: Buffer
}> {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl)
    const isHttps = url.protocol === 'https:'
    const transport = isHttps ? https : http

    const options: https.RequestOptions = {
      method: init.method,
      headers: Object.fromEntries(init.headers.entries()),
      lookup: (_hostname, _opts, callback) => {
        callback(null, pinnedIp, pinnedFamily)
      },
      signal: signal ?? undefined
    }
    if (isHttps) {
      // SNI must carry the original hostname (pinnedIp has no certificate).
      options.servername = url.hostname
    }

    const req = transport.request(url, options, (res) => {
      const chunks: Buffer[] = []
      let total = 0
      res.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > MAX_RESPONSE_BODY_BYTES) {
          req.destroy(new Error(`Response body exceeds ${MAX_RESPONSE_BODY_BYTES} bytes`))
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          headers: res.headers,
          body: Buffer.concat(chunks)
        })
      })
    })

    req.on('error', (error: NodeJS.ErrnoException) => {
      // Normalize abort into a fetch-compatible AbortError so callers can
      // distinguish user cancellation from real failures.
      if (signal?.aborted || error.code === 'ABORT_ERR') {
        reject(new DOMException('The operation was aborted.', 'AbortError'))
        return
      }
      reject(error)
    })

    const body = init.body
    if (body && body.length > 0) {
      req.write(body)
    }
    req.end()
  })
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
  // The redirect turned a body-carrying request into a body-less GET; drop the
  // credentials too so a rewritten/redirected endpoint never receives the
  // original provider secret.
  headers.delete('Authorization')
  const next: RequestInit = { ...init, method: 'GET', headers }
  delete next.body
  return next
}

/**
 * SSRF-safe fetch wrapper.
 *
 * Every hop (original request + each redirect) is:
 *  1. validated against the private/reserved address rules,
 *  2. DNS-resolved once, with every returned address checked,
 *  3. connected over a socket pinned to the validated address.
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
    const parsed = new URL(currentUrl)
    const err = validateProviderUrl(currentUrl)
    if (err) {
      throw new Error(`SSRF blocked: ${err}`)
    }

    const { ip, family } = await resolvePinnedIp(parsed.hostname)

    const method = (currentInit?.method || 'GET').toUpperCase()
    const headers = new Headers(currentInit?.headers)
    const response = await pinnedRequest(
      currentUrl,
      {
        method,
        headers,
        body: typeof currentInit?.body === 'string' ? currentInit.body : undefined
      },
      ip,
      family,
      currentInit?.signal
    )

    if (!isRedirectStatus(response.status)) {
      const responseHeaders = new Headers()
      for (const [name, value] of Object.entries(response.headers)) {
        if (typeof value === 'string') responseHeaders.set(name, value)
      }
      return new Response(new Uint8Array(response.body), {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      })
    }

    const locationHeader = response.headers.location
    if (!locationHeader) {
      const responseHeaders = new Headers()
      for (const [name, value] of Object.entries(response.headers)) {
        if (typeof value === 'string') responseHeaders.set(name, value)
      }
      return new Response(new Uint8Array(response.body), {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      })
    }

    const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader

    const target = new URL(location, currentUrl)
    const redirectErr = validateProviderUrl(target.href)
    if (redirectErr) {
      throw new Error(`SSRF blocked on redirect: ${redirectErr}`)
    }
    if (target.origin !== originalOrigin) {
      throw new Error(`Cross-origin redirect blocked: "${target.href}"`)
    }
    currentUrl = target.href
    currentInit = applyRedirectSemantics(response.status, currentInit)

    // Give the network stack a moment between hops; a hostile server could
    // otherwise starve this loop with instant 3xx responses.
    await sleep(1)
  }
  throw new Error('Too many redirects')
}

export { fetchWithSsrProtection, validateProviderUrl }
export type {} // satisfy isolatedModules
