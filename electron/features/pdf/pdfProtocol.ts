import crypto from 'crypto'
import { app, dialog, protocol } from 'electron'
import fs from 'fs'
import path from 'path'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { ConfigManager } from '../../core/ConfigManager.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { Logger } from '../../core/logger.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'

interface PDFData {
  path: string
  createdAt: number
}
const pdfRegistry = new Map<string, PDFData>()

/** Paths opened this session via PDF_REGISTER_PATH (drop/resume); not persisted. */
const sessionAllowedPdfPaths = new Set<string>()

type AllowListMap = Record<string, boolean>

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
const PDF_STREAM_HEADERS = {
  'Content-Type': 'application/pdf',
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'Accept-Ranges': 'bytes'
} as const

function logSuppressedError(scope: string, error: unknown): void {
  Logger.warn('[PDFProtocol] Suppressed:', scope, error)
}

function parseByteRange(
  rangeHeader: string,
  totalSize: number
): { start: number; end: number } | null {
  const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim())
  if (!match) {
    return null
  }

  const start = Number.parseInt(match[1], 10)
  const end = match[2] ? Number.parseInt(match[2], 10) : totalSize - 1

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
    return null
  }

  if (start >= totalSize || end >= totalSize) {
    return null
  }

  return { start, end }
}

const MAX_AGE_MS = 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000

let cleanupInterval: NodeJS.Timeout | null = null

function generateId() {
  return `pdf_${crypto.randomBytes(6).toString('hex')}_${Date.now()}`
}

function normalizePdfPath(filePath: string): string {
  return path.normalize(filePath)
}

function isPdfFilePath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.pdf'
}

function registerPdfPath(filePath: string): string {
  const id = generateId()
  pdfRegistry.set(id, { path: filePath, createdAt: Date.now() })
  return `local-pdf://${id}`
}

function createPdfResponseHeaders(stats: fs.Stats): Record<string, string> {
  return {
    ...PDF_STREAM_HEADERS,
    ETag: `W/"${stats.size}-${stats.mtimeMs}"`
  }
}

/**
 * Bridges a Node Readable stream to a Web ReadableStream so it can be served
 * as a Response body. Cancellation of the consumer destroys the underlying
 * Node stream to release the file descriptor.
 */
function fileStreamToWebStream(fileStream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      fileStream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)))
      fileStream.on('end', () => controller.close())
      fileStream.on('error', (err) => controller.error(err))
    },
    cancel() {
      fileStream.destroy()
    }
  })
}

const READ_BUFFER_BYTES = 1024 * 1024

function createPdfStreamResponse(
  filePath: string,
  stats: fs.Stats,
  rangeHeader: string | null
): Response {
  const headers = createPdfResponseHeaders(stats)

  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, stats.size)
    if (!range) {
      headers['Content-Range'] = `bytes */${stats.size}`
      return new Response(null, {
        status: 416,
        headers
      })
    }

    const { start, end } = range
    const chunkSize = end - start + 1
    const fileStream = fs.createReadStream(filePath, {
      start,
      end,
      highWaterMark: READ_BUFFER_BYTES
    })

    headers['Content-Range'] = `bytes ${start}-${end}/${stats.size}`
    headers['Content-Length'] = String(chunkSize)

    return new Response(fileStreamToWebStream(fileStream), {
      status: 206,
      headers
    })
  }

  const fileStream = fs.createReadStream(filePath, { highWaterMark: READ_BUFFER_BYTES })
  headers['Content-Length'] = String(stats.size)

  return new Response(fileStreamToWebStream(fileStream), {
    status: 200,
    headers
  })
}

function runCleanup() {
  const now = Date.now()
  let expiredCount = 0
  for (const [id, data] of pdfRegistry.entries()) {
    if (now - data.createdAt > MAX_AGE_MS) {
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

export function registerPdfProtocol() {
  protocol.handle('local-pdf', async (request) => {
    try {
      const url = new URL(request.url)
      const pdfId = url.host
      const pdfData = pdfRegistry.get(pdfId)

      if (!pdfData) return new Response('Forbidden', { status: 403 })

      const filePath = pdfData.path
      // Senkron existsSync kullanmayın: her byte-range isteğinde event
      // loop'u bloke eder. existsSync + promises.stat ikilisi zaten
      // gereksiz çift stat çağrısı demektir — sadece stat yeterlidir.
      let stats
      try {
        stats = await fs.promises.stat(filePath)
      } catch {
        return new Response('Not Found', { status: 404 })
      }
      const headers = createPdfResponseHeaders(stats)

      const ifNoneMatch = request.headers.get('if-none-match')
      if (ifNoneMatch === headers.ETag) {
        return new Response(null, {
          status: 304,
          headers
        })
      }

      const requestOrigin = request.headers.get('origin')
      const allowedOrigins = ['local-pdf://', 'file://', 'http://localhost', 'http://127.0.0.1']
      if (requestOrigin && !allowedOrigins.some((o) => requestOrigin.startsWith(o))) {
        return new Response('Forbidden', { status: 403 })
      }

      const response = createPdfStreamResponse(filePath, stats, request.headers.get('range'))
      if (requestOrigin) {
        const responseHeaders = new Headers(response.headers)
        responseHeaders.set('Access-Control-Allow-Origin', requestOrigin)
        responseHeaders.set('Vary', 'Origin')
        return new Response(response.body, { status: response.status, headers: responseHeaders })
      }
      return response
    } catch (error) {
      Logger.error('[PDFProtocol] Stream Error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  })
}

export function registerPdfProtocolHandlers() {
  const { IPC_CHANNELS } = APP_CONFIG

  const addToAllowlist = async (filePath: string) => {
    const normalized = normalizePdfPath(filePath)
    const manager = getAllowListManager()
    await manager.setItem(normalized, true)
  }

  const isAllowed = async (filePath: string) => {
    const normalized = normalizePdfPath(filePath)

    if (sessionAllowedPdfPaths.has(normalized)) return true

    const manager = getAllowListManager()
    const allowed = await manager.read()
    if (allowed[normalized]) return true

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
    IPC_CHANNELS.SELECT_FOLDER,
    async (event, options = {}) => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: options.title || 'Select Folder',
        defaultPath: options.defaultPath
      })

      if (canceled || filePaths.length === 0) return success(null)

      return success({ path: filePaths[0] })
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.SELECT_PDF,
    async (event, options = {}) => {
      const filterName = options.filterName || 'PDF Documents'
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: filterName, extensions: ['pdf'] }]
      })

      if (canceled || filePaths.length === 0) return success(null)

      const filePath = filePaths[0]
      try {
        const stats = await fs.promises.stat(filePath)

        // SECURITY: Persist allowlist only for explicit file-picker selection
        await addToAllowlist(filePath)
        const normalized = normalizePdfPath(filePath)
        sessionAllowedPdfPaths.add(normalized)

        const streamUrl = registerPdfPath(filePath)

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
    async (event, filePath) => {
      if (!filePath) return failure('invalid_input', 'File path is required')

      try {
        const normalizedPath = normalizePdfPath(filePath)

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
    async (event, filePath) => {
      if (!filePath) return failure('invalid_input', 'File path is required')
      try {
        const stats = await fs.promises.stat(filePath)
        if (!isPdfFilePath(filePath)) return failure('invalid_input', 'Not a PDF file')

        const normalized = normalizePdfPath(filePath)

        // SECURITY: Add to persistent allowlist (same as SELECT_PDF) to prevent
        // unregistered files from being served via GET_PDF_STREAM_URL later.
        // This also allows session-only registration for drag-and-drop and resume flows.
        await addToAllowlist(normalized)
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
