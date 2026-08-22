import { createHash, timingSafeEqual } from 'node:crypto'
import { promises as fs } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { request } from 'node:https'
import path from 'node:path'

/**
 * Hardened downloader for installer artifacts.
 *
 * Guarantees:
 * - HTTPS only, hosts restricted to a fixed allowlist (GitHub releases and
 *   its CDN redirect targets).
 * - The payload streams into a `.part` sibling file; the destination is never
 *   touched until the SHA-256 matches the pinned digest, then the file is
 *   atomically renamed into place.
 * - Hard size cap and an overall deadline; redirects are followed at most a
 *   few times and every hop must land on an allowlisted host.
 */

const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com'
])

export function isAllowedDownloadHost(hostname: string): boolean {
  return ALLOWED_DOWNLOAD_HOSTS.has(hostname.toLowerCase())
}

const MAX_REDIRECTS = 4
export const DEFAULT_MAX_BYTES = 512 * 1024 * 1024
export const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000

type DownloadErrorCode =
  | 'invalid_url'
  | 'redirect_disallowed'
  | 'too_many_redirects'
  | 'http_status'
  | 'size_exceeded'
  | 'timeout'
  | 'checksum_mismatch'
  | 'network_error'

export class DownloadError extends Error {
  readonly code: DownloadErrorCode

  constructor(code: DownloadErrorCode, message: string) {
    super(message)
    this.name = 'DownloadError'
    this.code = code
  }
}

function parseHttpsUrl(rawUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new DownloadError('invalid_url', `Malformed URL: ${rawUrl}`)
  }
  if (parsed.protocol !== 'https:') {
    throw new DownloadError('invalid_url', `Only https:// URLs are allowed: ${rawUrl}`)
  }
  if (!isAllowedDownloadHost(parsed.hostname)) {
    throw new DownloadError('redirect_disallowed', `Host not allowlisted: ${parsed.hostname}`)
  }
  return parsed
}

export interface DownloadOptions {
  url: string
  /** Final destination; written atomically after checksum verification. */
  destPath: string
  expectedSha256: string
  maxBytes?: number
  timeoutMs?: number
  onProgress?: (receivedBytes: number, totalBytes: number | null) => void
}

function fetchFollowingRedirects(
  url: string,
  deadline: number,
  remainingRedirects = MAX_REDIRECTS
): Promise<IncomingMessage> {
  const target = parseHttpsUrl(url)
  return new Promise((resolve, reject) => {
    const req = request(
      target,
      { method: 'GET', headers: { accept: 'application/octet-stream' } },
      (res) => {
        const status = res.statusCode ?? 0
        if (
          status === 301 ||
          status === 302 ||
          status === 303 ||
          status === 307 ||
          status === 308
        ) {
          res.resume()
          if (remainingRedirects <= 0) {
            reject(new DownloadError('too_many_redirects', 'Too many redirects'))
            return
          }
          const location = res.headers.location
          if (!location) {
            reject(new DownloadError('network_error', 'Redirect without Location header'))
            return
          }
          const next = new URL(location, target).toString()
          fetchFollowingRedirects(next, deadline, remainingRedirects - 1).then(resolve, reject)
          return
        }
        if (status < 200 || status >= 300) {
          res.resume()
          reject(new DownloadError('http_status', `Unexpected HTTP status ${status}`))
          return
        }
        resolve(res)
      }
    )
    req.on('error', (err) => reject(new DownloadError('network_error', String(err))))
    const timer = setInterval(() => {
      if (Date.now() > deadline) {
        req.destroy()
        reject(new DownloadError('timeout', 'Download exceeded the time limit'))
      }
    }, 5000)
    req.on('close', () => clearInterval(timer))
    req.end()
  })
}

/** Stream a response body to disk while hashing it; returns the hex digest. */
async function streamToTempFile(
  res: IncomingMessage,
  tempPath: string,
  maxBytes: number,
  onProgress?: DownloadOptions['onProgress']
): Promise<string> {
  const hash = createHash('sha256')
  const handle = await fs.open(tempPath, 'w')
  try {
    let received = 0
    const headerTotal = Number(res.headers['content-length'] ?? '')
    const total = Number.isFinite(headerTotal) && headerTotal > 0 ? headerTotal : null
    for await (const chunk of res) {
      received += (chunk as Buffer).length
      if (received > maxBytes) {
        throw new DownloadError('size_exceeded', `Download exceeds ${maxBytes} bytes`)
      }
      hash.update(chunk as Buffer)
      onProgress?.(received, total)
      await handle.write(chunk as Buffer)
    }
    return hash.digest('hex')
  } finally {
    await handle.close()
  }
}

function timingSafeHexEquals(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase(), 'utf8')
  const right = Buffer.from(b.toLowerCase(), 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function downloadFile(options: DownloadOptions): Promise<void> {
  const {
    url,
    destPath,
    expectedSha256,
    maxBytes = DEFAULT_MAX_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onProgress
  } = options

  const deadline = Date.now() + timeoutMs
  const tempPath = `${destPath}.part`
  await fs.mkdir(path.dirname(tempPath), { recursive: true })

  let actualDigest: string
  try {
    const res = await fetchFollowingRedirects(url, deadline)
    actualDigest = await streamToTempFile(res, tempPath, maxBytes, onProgress)
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {})
    throw error
  }

  if (!timingSafeHexEquals(actualDigest, expectedSha256)) {
    await fs.rm(tempPath, { force: true }).catch(() => {})
    throw new DownloadError(
      'checksum_mismatch',
      `Checksum mismatch: expected ${expectedSha256}, got ${actualDigest}`
    )
  }

  // SECURITY: rename is atomic on the same volume — the destination never
  // holds a partially downloaded or unverified artifact.
  await fs.rename(tempPath, destPath)
}
