import { isIP } from 'node:net'

/**
 * Where a host sits for SSRF purposes.
 *
 * The distinction that matters is not "private vs public" but *which private
 * addresses a local model server can legitimately live on*. `allowLocalNetwork`
 * exists so a user can point the app at Ollama / LM Studio / vLLM / LocalAI.
 * Those run on loopback or an RFC 1918 / ULA LAN address, so exactly those are
 * what the opt-in unlocks.
 *
 * `special-use` is the range of addresses that are never a model server: link
 * local (which is where cloud instance metadata lives, e.g. 169.254.169.254),
 * the unspecified block, CGNAT, benchmarking, documentation, multicast and the
 * IPv6 transition/tunnelling ranges that can encapsulate any of the above.
 * Treating those as "private, therefore opt-in allowed" turned a consent flag
 * for local inference into a way to reach infrastructure endpoints, so they are
 * blocked regardless of the flag.
 */
export const HOST_SCOPE = {
  /** Globally routable. Allowed unless a narrower rule above says otherwise. */
  PUBLIC: 'public',
  /** Loopback or RFC 1918 / ULA LAN. Blocked by default, allowed on opt-in. */
  LOCAL_MODEL: 'local-model',
  /** Never a valid target, blocked even with the opt-in. */
  SPECIAL_USE: 'special-use'
} as const

export type HostScope = (typeof HOST_SCOPE)[keyof typeof HOST_SCOPE]

type Ipv4Range = { start: string; end: string }

/**
 * Where a user runs a local inference server: this machine, or a host on their
 * own LAN. RFC 1918 (RFC 1918 / RFC 1918 §3) plus IPv4 loopback.
 */
const LOCAL_MODEL_IPV4_RANGES: readonly Ipv4Range[] = [
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  { start: '127.0.0.0', end: '127.255.255.255' }
]

/**
 * Addresses that stay blocked no matter what the user consented to.
 *
 * This is exactly the previous private-range list minus the local-model blocks
 * above — no range was added or removed, only reclassified — so the default
 * (no opt-in) behaviour is unchanged everywhere.
 *
 *   169.254.0.0/16  RFC 3927 link local; carries 169.254.169.254, the
 *                    AWS/GCP/Azure instance metadata endpoint
 *   0.0.0.0/8       RFC 1122 "this host"; a destination alias for loopback on
 *                    Linux, never a server address
 *   100.64.0.0/10   RFC 6598 shared address space (CGNAT)
 *   198.18.0.0/15   RFC 2544 benchmarking
 *   192.0.2.0/24    RFC 5737 TEST-NET-1
 *   198.51.100.0/24 RFC 5737 TEST-NET-2
 *   203.0.113.0/24  RFC 5737 TEST-NET-3
 *   224.0.0.0/4     RFC 5771 multicast
 *   240.0.0.0/4     RFC 1112 reserved / future use, incl. 255.255.255.255
 */
const SPECIAL_USE_IPV4_RANGES: readonly Ipv4Range[] = [
  { start: '169.254.0.0', end: '169.254.255.255' },
  { start: '0.0.0.0', end: '0.255.255.255' },
  { start: '100.64.0.0', end: '100.127.255.255' },
  { start: '198.18.0.0', end: '198.19.255.255' },
  { start: '192.0.2.0', end: '192.0.2.255' },
  { start: '198.51.100.0', end: '198.51.100.255' },
  { start: '203.0.113.0', end: '203.0.113.255' },
  { start: '224.0.0.0', end: '239.255.255.255' },
  { start: '240.0.0.0', end: '255.255.255.255' }
]

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/

const ipToInt = (ip: string): number => {
  const parts = ip.split('.').map(Number)
  return (
    ((parts[0] || 0) << 24) | ((parts[1] || 0) << 16) | ((parts[2] || 0) << 8) | (parts[3] || 0)
  )
}

function isInAnyRange(ipInt: number, ranges: readonly Ipv4Range[]): boolean {
  return ranges.some(({ start, end }) => ipInt >= ipToInt(start) && ipInt <= ipToInt(end))
}

function classifyIPv4(ip: string): HostScope {
  if (!IPV4_RE.test(ip)) return HOST_SCOPE.PUBLIC
  const ipInt = ipToInt(ip)
  // Special-use wins: no address is in both lists today, but the order keeps
  // the stronger guarantee if one ever overlaps.
  if (isInAnyRange(ipInt, SPECIAL_USE_IPV4_RANGES)) return HOST_SCOPE.SPECIAL_USE
  if (isInAnyRange(ipInt, LOCAL_MODEL_IPV4_RANGES)) return HOST_SCOPE.LOCAL_MODEL
  return HOST_SCOPE.PUBLIC
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
    // Rewrite the dotted tail into the two hextets it encodes. These have to be
    // built from the octet pairs, not by zero-padding each octet: "7f00:0001",
    // not "7f000001". Concatenating padded octets produces a malformed address
    // that no longer matches the ::ffff:/:: compatible prefixes below, which
    // silently classified ::ffff:127.0.0.1 as public instead of local.
    const octets = v4Tail[1].split('.').map(Number)
    const high = ((octets[0] << 8) | octets[1]).toString(16).padStart(4, '0')
    const low = ((octets[2] << 8) | octets[3]).toString(16).padStart(4, '0')
    address = `${address.slice(0, v4Tail.index)}${high}:${low}`
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

function classifyIPv6(host: string): HostScope {
  const groups = expandIPv6(host)
  if (!groups) return HOST_SCOPE.PUBLIC

  const isZeroPrefix = groups.slice(0, 7).every((group) => group === '0000')

  // :: (unspecified) — the IPv6 counterpart of 0.0.0.0/8.
  if (groups.every((group) => group === '0000')) return HOST_SCOPE.SPECIAL_USE
  // ::1 (loopback) — a local model server target.
  if (isZeroPrefix && groups[7] === '0001') return HOST_SCOPE.LOCAL_MODEL

  // IPv4-compatible (::a.b.c.d) and IPv4-mapped (::ffff:a.b.c.d) forms embed a
  // dotted-quad address in the last 32 bits. Classify the embedded address so
  // ::ffff:127.0.0.1 is a local-model target while ::ffff:169.254.169.254 stays
  // special-use and cannot sneak past the metadata block.
  const compatible = groups.slice(0, 6).every((group) => group === '0000')
  const mapped = groups.slice(0, 5).every((group) => group === '0000') && groups[5] === 'ffff'
  if (compatible || mapped) {
    const embeddedV4 = [
      Number.parseInt(groups[6].slice(0, 2), 16),
      Number.parseInt(groups[6].slice(2, 4), 16),
      Number.parseInt(groups[7].slice(0, 2), 16),
      Number.parseInt(groups[7].slice(2, 4), 16)
    ].join('.')
    const embeddedScope = classifyIPv4(embeddedV4)
    if (embeddedScope !== HOST_SCOPE.PUBLIC) return embeddedScope
  }

  const first = Number.parseInt(groups[0], 16)
  const second = Number.parseInt(groups[1], 16)
  // Link-local fe80::/10 — the IPv6 counterpart of 169.254.0.0/16.
  if (first >= 0xfe80 && first <= 0xfebf) return HOST_SCOPE.SPECIAL_USE
  // Unique local addresses fc00::/7 — the IPv6 counterpart of RFC 1918.
  if (first >= 0xfc00 && first <= 0xfdff) return HOST_SCOPE.LOCAL_MODEL
  // Multicast ff00::/8
  if ((first & 0xff00) === 0xff00) return HOST_SCOPE.SPECIAL_USE
  // Documentation 2001:db8::/32
  if (first === 0x2001 && second === 0x0db8) return HOST_SCOPE.SPECIAL_USE
  // 6to4 (2002::/16) and Teredo (2001:0000::/32) can tunnel to any IPv4,
  // including link local, so they cannot be reasoned about from the outer prefix.
  if (first === 0x2002) return HOST_SCOPE.SPECIAL_USE
  if (first === 0x2001 && second === 0x0000) return HOST_SCOPE.SPECIAL_USE

  return HOST_SCOPE.PUBLIC
}

/**
 * Normalizes a URL hostname for security checks: strips IPv6 brackets and a
 * single trailing root dot ("localhost." and "[::1]" are the same destinations
 * as "localhost" and "::1", so they must be checked identically).
 */
export function normalizeHostname(hostname: string): string {
  let host = hostname.toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1)
  }
  if (host.endsWith('.') && !host.endsWith('..')) {
    host = host.slice(0, -1)
  }
  return host
}

/**
 * Classifies a hostname or IP literal into one of three scopes.
 *
 * Callers decide what to allow; this function only answers "where does this
 * host sit", so the same policy applies to a literal URL and to an address that
 * DNS resolution produced.
 */
export function classifyHost(hostname: string): HostScope {
  const host = normalizeHostname(hostname)

  if (host === '') return HOST_SCOPE.SPECIAL_USE
  // The DNS root. Not a host, and resolvable, so it must not ride along on the
  // "single-label names are local" rule below.
  if (host === '.') return HOST_SCOPE.SPECIAL_USE
  if (host === 'localhost') return HOST_SCOPE.LOCAL_MODEL

  if (isIP(host) === 4) return classifyIPv4(host)
  if (isIP(host) === 6) return classifyIPv6(host)

  // Single-label hostnames ("internal", a local search-domain name) can only
  // resolve on local/private namespaces — there is no public TLD for them.
  if (!host.includes('.')) return HOST_SCOPE.LOCAL_MODEL

  return HOST_SCOPE.PUBLIC
}
