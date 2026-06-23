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

export { validateProviderUrl }
export type {} // satisfy isolatedModules
