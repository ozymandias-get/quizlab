import crypto from 'crypto'
import { app, dialog, protocol } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { ConfigManager } from '../../core/ConfigManager.js'
import { getDefaultDialogDirectory, rememberDialogDirectory } from '../../core/dialogDirectory.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { Logger } from '../../core/logger.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { createPdfResponseHeaders, createPdfStreamResponse } from './pdfStreamUtils.js'

interface PDFData {
  path: string
  createdAt: number
  /** Refreshed on every stream request so long-lived tabs are not evicted. */
  lastAccessAt: number
}
const pdfRegistry = new Map<string, PDFData>()

/** Paths opened this session via PDF_REGISTER_PATH (drop/resume); not persisted. */
const sessionAllowedPdfPaths = new Set<string>()

/**
 * A path the user selected in the file picker.
 *
 * The size and modification time are the identity of the file that was
 * approved. A different file placed at the same path no longer inherits the
 * permission; the user has to select it again. Old boolean entries are not
 * trusted, because they carry no identity to verify.
 */
interface PdfAllowEntry {
  allowed: true
  size: number
  mtimeMs: number
}
type AllowListMap = Record<string, PdfAllowEntry>

// SECURITY: Singleton ConfigManager instance for the PDF allowlist.
// Creating a new ConfigManager per call would cause multiple instances
// with separate operation queues and in-memory caches pointing to the
// same file.  Concurrent calls would then race — each instance reads
// its own stale cache, modifies it, and writes back, silently
// overwriting the other's changes (lost update).
let allowListManager: ConfigManager<AllowListMap> | null = null

function getAllowListManager(): ConfigManager<AllowListMap> {
  if (!allowListManager) {
    const filePath = path.join(app.getPath('userData'), 'pdf-allowlist.json')
    allowListManager = new ConfigManager<AllowListMap>(filePath)
  }
  return allowListManager
}

function logSuppressedError(scope: string, error: unknown): void {
  Logger.warn('[PDFProtocol] Suppressed:', scope, error)
}

const MAX_AGE_MS = 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000

let cleanupInterval: NodeJS.Timeout | null = null

function generateId() {
  return `pdf_${crypto.randomBytes(6).toString('hex')}_${Date.now()}`
}

function isPdfFilePath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.pdf'
}

/**
 * A light content check.
 *
 * The extension is not proof of the format. Only the header is read: PDF.js
 * still owns parsing and error handling, so this is not a second parser. A
 * BOM or a few leading whitespace bytes are tolerated because some writers
 * emit them before `%PDF-`.
 */
async function hasPdfSignature(filePath: string): Promise<boolean> {
  let handle: fs.promises.FileHandle | null = null
  try {
    handle = await fs.promises.open(filePath, 'r')
    const buffer = Buffer.alloc(1024)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const head = buffer.subarray(0, bytesRead).toString('latin1')
    return /^\uFEFF?\s{0,32}%PDF-/u.test(head)
  } catch {
    return false
  } finally {
    await handle?.close().catch(() => undefined)
  }
}

function registerPdfPath(filePath: string): string {
  const id = generateId()
  const now = Date.now()
  pdfRegistry.set(id, { path: filePath, createdAt: now, lastAccessAt: now })
  return `local-pdf://${id}`
}

function runCleanup() {
  const now = Date.now()
  let expiredCount = 0
  for (const [id, data] of pdfRegistry.entries()) {
    // Idle-based expiry: entries still being streamed (lastAccessAt recent)
    // survive even if they were opened more than MAX_AGE_MS ago.
    if (now - data.lastAccessAt > MAX_AGE_MS) {
      pdfRegistry.delete(id)
      expiredCount++
    }
  }

  if (expiredCount > 0) {
    const activePaths = new Set([...pdfRegistry.values()].map((d) => d.path))
    for (const allowedPath of sessionAllowedPdfPaths) {
      if (!activePaths.has(allowedPath)) {
        sessionAllowedPdfPaths.delete(allowedPath)
      }
    }
  }
}

export function registerPdfScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'local-pdf',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

/** Whether a path is inside a directory (both must be absolute). */
function isPathInside(directory: string, target: string): boolean {
  const relative = path.relative(path.resolve(directory), path.resolve(target))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

/**
 * Whether a `null` origin comes from a local app document.
 *
 * An opaque origin is not proof of trust on its own: sandboxed and data:
 * documents can produce it too. A `file:` referer under the app directory is
 * the additional boundary.
 */
function isTrustedLocalReferer(referer: string | null): boolean {
  if (!referer) return false
  try {
    const parsed = new URL(referer)
    if (parsed.protocol === 'file:') {
      // `pathname` is `/C:/...` on Windows and breaks path comparisons against
      // `app.getAppPath()`. `fileURLToPath` returns the real platform path.
      return isPathInside(app.getAppPath(), fileURLToPath(parsed))
    }
    // The Vite dev server can issue an opaque-origin request with a localhost
    // referer. It is still the local app, never a remote page.
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

// Exact origin validation (no prefix matching): a crafted origin like
// "http://localhost.evil.com" or "local-pdf://<unregistered>" must not pass.
function isAllowedPdfOrigin(origin: string, referer: string | null = null): boolean {
  // `null` is an opaque origin, not a trust signal: require the local app
  // document as its referer.
  if (origin === 'null') return isTrustedLocalReferer(referer)
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  if (parsed.protocol === 'local-pdf:') {
    // Only pages actually served by this protocol (their host is the
    // registered pdf id) may fetch resources back from it.
    return pdfRegistry.has(parsed.hostname)
  }
  if (parsed.protocol === 'file:') {
    return true
  }
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    // Dev server (any port) and nothing else.
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  }
  return false
}

/**
 * Whether the request may read a registered PDF.
 *
 * Origin/Referer are the primary proof. A request with neither is not trusted
 * by default: only a top-level navigation is accepted, and a declared
 * cross-site request is always refused.
 */
function isAllowedPdfRequest(headers: Headers, requestReferrer?: string): boolean {
  const origin = headers.get('origin')
  const headerReferer = headers.get('referer')
  // Electron can omit the Referer header for custom schemes while still
  // exposing the originating document on the Request object.
  const fallbackReferer =
    requestReferrer && requestReferrer !== 'about:client' ? requestReferrer : null
  const referer = headerReferer ?? fallbackReferer

  if (origin) {
    if (origin === 'null') {
      // Opaque origins are what Chromium reports for our own file:// document
      // and for custom-scheme fetch/media requests. The registry id has already
      // been verified by the caller and is an unguessable capability, so a
      // present local referer is enough; cross-site hints are not reliable
      // here. A remote referer is still refused.
      if (referer) return isTrustedLocalReferer(referer)
      return true
    }
    return isAllowedPdfOrigin(origin, referer)
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin
      if (refOrigin !== 'null' && !isAllowedPdfOrigin(refOrigin, referer)) return false
      if (refOrigin === 'null' && !isTrustedLocalReferer(referer)) return false
      return true
    } catch {
      return false
    }
  }

  // No origin/referer at all. Chromium sometimes strips both for custom-scheme
  // range requests; the registered id is the capability that authorizes it.
  // Foreign origins and referers were rejected above.
  return true
}

export function registerPdfProtocol() {
  protocol.handle('local-pdf', async (request) => {
    try {
      const url = new URL(request.url)
      const pdfId = url.host
      const pdfData = pdfRegistry.get(pdfId)

      if (!pdfData) {
        Logger.warn('[PDFProtocol] Refused unknown id:', pdfId)
        // 404 (not 403) distinguishes a stale/unknown id from an origin refusal
        // and matches the missing-file response below.
        return new Response('Unknown PDF id', { status: 404 })
      }
      pdfData.lastAccessAt = Date.now()

      const filePath = pdfData.path
      // Open the file first and read its metadata from the descriptor: the
      // bytes that are streamed belong to the same file that produced the
      // size, ETag and Content-Range, even when the path is replaced.
      let fileHandle: fs.promises.FileHandle
      try {
        fileHandle = await fs.promises.open(filePath, 'r')
      } catch {
        return new Response('Not Found', { status: 404 })
      }

      let stats: fs.Stats
      try {
        stats = await fileHandle.stat()
      } catch {
        await fileHandle.close().catch(() => undefined)
        return new Response('Not Found', { status: 404 })
      }

      try {
        const headers = createPdfResponseHeaders(stats)
        const requestOrigin = request.headers.get('origin')

        // Authorization runs before ETag: a client that may not read the PDF
        // must not learn its ETag or whether the cache entry is current.
        if (!isAllowedPdfRequest(request.headers, request.referrer)) {
          Logger.warn('[PDFProtocol] Refused request origin:', {
            id: pdfId,
            origin: request.headers.get('origin'),
            referer: request.headers.get('referer'),
            fallbackReferer: request.referrer,
            site: request.headers.get('sec-fetch-site'),
            mode: request.headers.get('sec-fetch-mode')
          })
          await fileHandle.close()
          return new Response('Forbidden', { status: 403 })
        }

        if (requestOrigin && requestOrigin !== 'null') {
          headers['Access-Control-Allow-Origin'] = requestOrigin
          headers['Vary'] = 'Origin'
        }

        const ifNoneMatch = request.headers.get('if-none-match')
        if (ifNoneMatch === headers.ETag) {
          await fileHandle.close()
          return new Response(null, {
            status: 304,
            headers
          })
        }

        // On success the stream owns the descriptor; a 416 or a failed stream
        // setup closes it inside createPdfStreamResponse.
        return await createPdfStreamResponse(
          filePath,
          stats,
          request.headers.get('range'),
          headers,
          fileHandle
        )
      } catch (error) {
        await fileHandle.close().catch(() => undefined)
        throw error
      }
    } catch (error) {
      Logger.error('[PDFProtocol] Stream Error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  })
}

export function registerPdfProtocolHandlers() {
  const { IPC_CHANNELS } = APP_CONFIG

  const addToAllowlist = async (filePath: string) => {
    const normalized = path.normalize(filePath)
    const stats = await fs.promises.stat(normalized)
    const manager = getAllowListManager()
    await manager.setItem(normalized, {
      allowed: true,
      size: stats.size,
      mtimeMs: stats.mtimeMs
    } satisfies PdfAllowEntry)
  }

  const isAllowed = async (filePath: string) => {
    const normalized = path.normalize(filePath)

    if (sessionAllowedPdfPaths.has(normalized)) return true

    const manager = getAllowListManager()
    const allowed = await manager.read()
    const entry = allowed[normalized]
    if (entry && typeof entry === 'object' && entry.allowed === true) {
      try {
        const stats = await fs.promises.stat(normalized)
        if (stats.size === entry.size && stats.mtimeMs === entry.mtimeMs) return true
        Logger.warn('[PDFProtocol] The allowlisted file changed on disk; asking for it again.')
        return false
      } catch {
        return false
      }
    }

    try {
      const userDataPath = app.getPath('userData')
      const rel = path.relative(userDataPath, normalized)

      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        return true
      }
    } catch (e) {
      logSuppressedError('isAllowed.userDataPath', e)
    }

    return false
  }

  registerIpcHandler(
    IPC_CHANNELS.SELECT_PDF,
    async (_event, options = {}) => {
      const filterName = options.filterName || 'PDF Documents'
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: filterName, extensions: ['pdf'] }],
        defaultPath: getDefaultDialogDirectory()
      })

      if (canceled || filePaths.length === 0) return success(null)

      const filePath = filePaths[0]
      // Electron 43 no longer restores the last used directory on its own, so
      // the next picker would start in Downloads; remember this one instead.
      rememberDialogDirectory(filePaths[0])
      try {
        const stats = await fs.promises.stat(filePath)
        if (!(await hasPdfSignature(filePath))) {
          return failure('invalid_input', 'Not a PDF file')
        }

        // SECURITY: Persist allowlist only for explicit file-picker selection
        await addToAllowlist(filePath)
        const normalized = path.normalize(filePath)
        sessionAllowedPdfPaths.add(normalized)

        // Register the NORMALIZED path so the protocol handler and the
        // allowlist resolve to the same key (avoids duplicate registry
        // entries from paths differing only in case, separators or 8.3 names).
        const streamUrl = registerPdfPath(normalized)

        return success({
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          streamUrl
        })
      } catch (err) {
        Logger.error('[PDFProtocol] Selection error:', err)
        return failure('internal_error', (err as Error).message)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.GET_PDF_STREAM_URL,
    async (_event, filePath) => {
      if (!filePath) return failure('invalid_input', 'File path is required')

      try {
        const normalizedPath = path.normalize(filePath)

        if (!(await isAllowed(normalizedPath))) {
          Logger.warn(
            '[PDFProtocol] Security Warning: Unauthorized PDF access attempt:',
            normalizedPath
          )
          return failure('unauthorized', 'Pdf not in allowlist')
        }

        try {
          await fs.promises.access(normalizedPath)
        } catch {
          return failure('not_found', 'File not found')
        }
        if (isPdfFilePath(normalizedPath)) {
          return success({ streamUrl: registerPdfPath(normalizedPath) })
        }
      } catch (err) {
        Logger.error('[PDFProtocol] Resolve Error:', err)
        return failure('internal_error', (err as Error).message)
      }
      return failure('invalid_input', 'Not a PDF file')
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.PDF_REGISTER_PATH,
    async (_event, filePath) => {
      if (!filePath) return failure('invalid_input', 'File path is required')
      try {
        const stats = await fs.promises.stat(filePath)
        if (!isPdfFilePath(filePath)) return failure('invalid_input', 'Not a PDF file')
        if (!(await hasPdfSignature(filePath))) {
          return failure('invalid_input', 'Not a PDF file')
        }

        const normalized = path.normalize(filePath)

        // SECURITY: This path came from the renderer (drag/drop, shell open,
        // resume), not from the user's file picker. It is enough for the
        // current session, but it must not become a permanent permission: the
        // restore flow registers the path again after a restart.
        sessionAllowedPdfPaths.add(normalized)

        return success({
          path: normalized,
          name: path.basename(normalized),
          size: stats.size,
          streamUrl: registerPdfPath(normalized)
        })
      } catch (err) {
        Logger.error('[PDFProtocol] Register error:', err)
        return failure('internal_error', (err as Error).message)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}

export function startPdfCleanupInterval() {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(runCleanup, CLEANUP_INTERVAL_MS)
    if (
      cleanupInterval &&
      typeof cleanupInterval === 'object' &&
      'unref' in cleanupInterval &&
      typeof (cleanupInterval as unknown as { unref: () => void }).unref === 'function'
    ) {
      ;(cleanupInterval as unknown as { unref: () => void }).unref()
    }
  }
}

export function stopPdfCleanupInterval() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

export const clearAllPdfPaths = () => {
  pdfRegistry.clear()
  sessionAllowedPdfPaths.clear()
}
