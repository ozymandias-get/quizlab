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

const ipToInt = (ip: string): number => {
  const parts = ip.split('.').map(Number)
  return (
    ((parts[0] || 0) << 24) | ((parts[1] || 0) << 16) | ((parts[2] || 0) << 8) | (parts[3] || 0)
  )
}

const isPrivateIP = (ip: string): boolean => {
  const ipInt = ipToInt(ip)
  return PRIVATE_IP_RANGES.some(({ start, end }) => {
    return ipInt >= ipToInt(start) && ipInt <= ipToInt(end)
  })
}

const isLoopbackOrPrivateHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase()

  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true

  const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/
  if (IP_RE.test(host)) {
    return isPrivateIP(host)
  }

  if (host === 'localhost' || host === '127.0.0.1') return true

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
    if (
      parsed.protocol !== 'https:' &&
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1'
    ) {
      return 'Non-HTTPS provider URLs are only allowed for localhost'
    }

    // Skip SSRF block for localhost/127.0.0.1 since they are already
    // handled above — HTTP is explicitly allowed for local development.
    if (
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1' &&
      isLoopbackOrPrivateHost(parsed.hostname)
    ) {
      return `SSRF blocked: "${parsed.hostname}" is a private/reserved address`
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
