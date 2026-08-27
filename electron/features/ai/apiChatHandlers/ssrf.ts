import type { LookupAddress } from 'node:dns'
import { lookup as dnsLookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'

import { isLoopbackOrPrivateHost, normalizeHostname } from './ssrfIpUtils.js'

export interface SsrProtectionOptions {
  allowLocalNetwork?: boolean
  /** alias for allowLocalNetwork */
  allowLocalEndpoints?: boolean
  /** alias for allowLocalNetwork — custom providers often local */
  isCustomProvider?: boolean
}

function isLocalAllowed(options?: SsrProtectionOptions): boolean {
  return Boolean(
    options?.allowLocalNetwork || options?.allowLocalEndpoints || options?.isCustomProvider
  )
}

function validateProviderUrl(baseUrl: string, options?: SsrProtectionOptions): string | null {
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
    const allowLocal = isLocalAllowed(options)
    const isPrivate = isLoopbackOrPrivateHost(host)
    const isAllowedHttpHost = isLocalDevHost || (allowLocal && isPrivate)

    if (parsed.protocol !== 'https:' && !isAllowedHttpHost) {
      return 'Non-HTTPS provider URLs are only allowed for localhost'
    }

    // Skip SSRF block for localhost/127.0.0.1 since they are already
    // handled above — HTTP is explicitly allowed for local development.
    // When allowLocalNetwork is true (Ollama / LM Studio / vLLM / LocalAI)
    // private/reserved loopback & LAN addresses are permitted with explicit
    // user consent.
    if (!allowLocal && !isLocalDevHost && isPrivate) {
      return `SSRF blocked: "${host}" is a private/reserved address`
    }

    return null
  } catch {
    return 'Invalid URL'
  }
}

// Alias for issue naming — validateSsrfTarget is the name used in the bug report
const validateSsrfTarget = validateProviderUrl

// ─────────────────────────────────────────────────────────────────────────────
// DNS rebinding (TOCTOU) protection
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RESPONSE_BODY_BYTES = 50 * 1024 * 1024 // 50 MB

async function resolvePinnedIp(
  hostname: string,
  options?: SsrProtectionOptions
): Promise<{ ip: string; family: number }> {
  const host = normalizeHostname(hostname)
  const allowLocal = isLocalAllowed(options)

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

  // EVERY returned address must be public unless allowLocalNetwork is set.
  // If any single A/AAAA record points into a private/reserved block the whole
  // request is rejected — prevents DNS rebinding to 127.0.0.1 / 192.168.x.x /
  // 169.254.169.254 after an initially public hostname.
  if (!allowLocal) {
    for (const address of addresses) {
      if (isLoopbackOrPrivateHost(address.address)) {
        throw new Error(
          `SSRF blocked: "${hostname}" resolved to private/reserved address ${address.address}`
        )
      }
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
 * SSRF-safe fetch wrapper. Pass `allowLocalNetwork:true` for Ollama / LM Studio
 * / vLLM / LocalAI custom providers to permit loopback & LAN targets.
 */
async function fetchWithSsrProtection(
  url: string,
  init?: RequestInit,
  options?: SsrProtectionOptions
): Promise<Response> {
  const originalParsed = new URL(url)
  let currentUrl = url
  let currentInit = init

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(currentUrl)
    const err = validateProviderUrl(currentUrl, options)
    if (err) {
      throw new Error(`SSRF blocked: ${err}`)
    }

    const { ip, family } = await resolvePinnedIp(parsed.hostname, options)

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
    const redirectErr = validateProviderUrl(target.href, options)
    if (redirectErr) {
      throw new Error(`SSRF blocked on redirect: ${redirectErr}`)
    }
    // Compare hostname + protocol only (ignore port) to allow
    // implicit vs explicit default-port redirects (e.g. :443) while still
    // blocking true cross-origin hops.
    if (
      target.hostname !== originalParsed.hostname ||
      target.protocol !== originalParsed.protocol
    ) {
      throw new Error(`Cross-origin redirect blocked: "${target.href}"`)
    }
    currentUrl = target.href
    currentInit = applyRedirectSemantics(response.status, currentInit)

    // Give the network stack a moment between hops.
    await sleep(1)
  }
  throw new Error('Too many redirects')
}

export { fetchWithSsrProtection, validateProviderUrl, validateSsrfTarget }
export type {} // satisfy isolatedModules
