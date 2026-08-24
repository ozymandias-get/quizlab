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
  | 'aborted'

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
  signal?: AbortSignal
}

function fetchFollowingRedirects(
  url: string,
  deadline: number,
  remainingRedirects = MAX_REDIRECTS,
  extraHeaders: Record<string, string> = {},
  signal?: AbortSignal
): Promise<IncomingMessage> {
  if (signal?.aborted) {
    return Promise.reject(new DownloadError('aborted', 'Download aborted'))
  }
  const target = parseHttpsUrl(url)
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { accept: 'application/octet-stream', ...extraHeaders }
    const req = request(target, { method: 'GET', headers }, (res) => {
      const status = res.statusCode ?? 0
      if (status === 301 || status === 302 || status === 303 || status === 307 || status === 308) {
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
        fetchFollowingRedirects(next, deadline, remainingRedirects - 1, extraHeaders, signal).then(
          resolve,
          reject
        )
        return
      }
      if (status < 200 || status >= 300) {
        if (status === 416) {
          // Range Not Satisfiable – resume offset beyond file, restart from 0
          res.resume()
          reject(new DownloadError('network_error', 'Range not satisfiable, restart required'))
          return
        }
        res.resume()
        reject(new DownloadError('http_status', `Unexpected HTTP status ${status}`))
        return
      }
      resolve(res)
    })
    const onAbort = (): void => {
      req.destroy()
      reject(new DownloadError('aborted', 'Download aborted'))
    }
    if (signal) {
      if (signal.aborted) {
        req.destroy()
        reject(new DownloadError('aborted', 'Download aborted'))
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }
    req.on('error', (err) => {
      if (signal?.aborted) {
        reject(new DownloadError('aborted', 'Download aborted'))
      } else {
        reject(new DownloadError('network_error', String(err)))
      }
    })
    const timer = setInterval(() => {
      if (Date.now() > deadline) {
        req.destroy()
        reject(new DownloadError('timeout', 'Download exceeded the time limit'))
      }
      if (signal?.aborted) {
        req.destroy()
        reject(new DownloadError('aborted', 'Download aborted'))
      }
    }, 5000)
    const cleanup = (): void => {
      clearInterval(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    req.on('close', cleanup)
    // Also handle immediate abort after request creation
    signal?.addEventListener('abort', () => req.destroy(), { once: true })
    req.end()
  })
}

/** Stream a response body to disk while hashing it; returns the hex digest. */
async function streamToTempFile(
  res: IncomingMessage,
  tempPath: string,
  maxBytes: number,
  onProgress?: DownloadOptions['onProgress'],
  signal?: AbortSignal,
  existingBytes = 0,
  existingHash?: ReturnType<typeof createHash>
): Promise<string> {
  const hash = existingHash ?? createHash('sha256')
  const handle = await fs.open(tempPath, existingBytes > 0 ? 'a' : 'w')
  try {
    let received = existingBytes
    const headerTotal = Number(res.headers['content-length'] ?? '')
    // If resuming (206), content-length is remaining bytes, so add existing
    const total =
      Number.isFinite(headerTotal) && headerTotal > 0
        ? headerTotal + (res.statusCode === 206 ? existingBytes : 0)
        : null
    // Report initial progress for resumed case
    if (existingBytes > 0) onProgress?.(received, total)
    for await (const chunk of res) {
      if (signal?.aborted) {
        throw new DownloadError('aborted', 'Download aborted')
      }
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
    onProgress,
    signal
  } = options

  if (signal?.aborted) {
    throw new DownloadError('aborted', 'Download aborted before start')
  }

  const deadline = Date.now() + timeoutMs
  const tempPath = `${destPath}.part`
  await fs.mkdir(path.dirname(tempPath), { recursive: true })

  // Check for resumable partial file
  let existingBytes = 0
  let existingHash: ReturnType<typeof createHash> | undefined
  try {
    const stat = await fs.stat(tempPath)
    if (stat.isFile() && stat.size > 0 && stat.size < maxBytes) {
      existingBytes = stat.size
      // Pre-hash existing content for correct final digest
      const hash = createHash('sha256')
      const handle = await fs.open(tempPath, 'r')
      try {
        const buf = Buffer.alloc(64 * 1024)
        let bytesRead = 0
        let result: { bytesRead: number; buffer: Buffer } | null = null
        // Simple read loop for existing file

        while (true) {
          const { bytesRead: n } = await handle.read(buf, 0, buf.length, bytesRead)
          if (n === 0) break
          hash.update(buf.subarray(0, n))
          bytesRead += n
        }
      } finally {
        await handle.close()
      }
      existingHash = hash
    } else if (stat.size >= maxBytes) {
      // Oversized stale part – discard
      await fs.rm(tempPath, { force: true }).catch(() => {})
      existingBytes = 0
    }
  } catch {
    existingBytes = 0
    existingHash = undefined
  }

  let actualDigest: string
  let usedResumable = false
  try {
    const extraHeaders: Record<string, string> = {}
    if (existingBytes > 0) {
      extraHeaders['Range'] = `bytes=${existingBytes}-`
    }
    let res: IncomingMessage
    try {
      res = await fetchFollowingRedirects(url, deadline, MAX_REDIRECTS, extraHeaders, signal)
    } catch (err) {
      // If Range request failed with 416 or network error and we were resuming, retry without Range
      if (
        existingBytes > 0 &&
        err instanceof DownloadError &&
        (err.code === 'network_error' || err.message.includes('Range'))
      ) {
        await fs.rm(tempPath, { force: true }).catch(() => {})
        existingBytes = 0
        existingHash = undefined
        res = await fetchFollowingRedirects(url, deadline, MAX_REDIRECTS, {}, signal)
      } else {
        throw err
      }
    }
    // Server ignored Range (200 instead of 206) – restart from 0
    if (existingBytes > 0 && res.statusCode !== 206) {
      await fs.rm(tempPath, { force: true }).catch(() => {})
      existingBytes = 0
      existingHash = undefined
      // Need to re-fetch without Range if we already consumed the 200 response
      // For simplicity, if server returned 200 with Range, discard and re-fetch without Range
      // The current res is the 200 response – we can use it directly with fresh file
      // But to avoid double-download, we already have the 200 response's body – use it
      // So we keep res as is and stream to fresh file (existingBytes reset)
    } else if (existingBytes > 0 && res.statusCode === 206) {
      usedResumable = true
    }
    actualDigest = await streamToTempFile(
      res,
      tempPath,
      maxBytes,
      onProgress,
      signal,
      existingBytes,
      existingHash
    )
  } catch (error) {
    // On abort, keep .part for resume; on other errors, clean up unless resuming
    if (error instanceof DownloadError && error.code === 'aborted') {
      throw error
    }
    // For non-abort errors, remove temp only if not in a resumable state that could be retried
    // Keep .part for resumable case to allow next attempt to resume
    if (!usedResumable) {
      await fs.rm(tempPath, { force: true }).catch(() => {})
    }
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
