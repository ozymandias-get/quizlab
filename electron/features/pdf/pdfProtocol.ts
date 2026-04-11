import { protocol, ipcMain, dialog, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { Readable } from 'stream'
import crypto from 'crypto'
import { APP_CONFIG } from '../../app/constants'
import { ConfigManager } from '../../core/ConfigManager'
import { requireTrustedIpcSender } from '../../core/ipcSecurity'

interface PDFData {
  path: string
  createdAt: number
}
const pdfRegistry = new Map<string, PDFData>()

/** Paths opened this session via PDF_REGISTER_PATH (drop/resume); not persisted. */
const sessionAllowedPdfPaths = new Set<string>()

type AllowListMap = Record<string, boolean>
const ALLOWLIST_FILE = path.join(app.getPath('userData'), 'pdf-allowlist.json')
const allowListManager = new ConfigManager<AllowListMap>(ALLOWLIST_FILE)
const PDF_STREAM_HEADERS = {
  'Content-Type': 'application/pdf',
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'Accept-Ranges': 'bytes',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*'
} as const

function logSuppressedError(scope: string, error: unknown): void {
  console.warn('[PDFProtocol] Suppressed:', scope, error)
}

function toWebStream(nodeStream: fs.ReadStream): ReadableStream<Uint8Array> {
  return Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>
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

/**
 * Generate a unique ID for the PDF stream
 */
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
    const webStream = toWebStream(
      fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 })
    )

    headers['Content-Range'] = `bytes ${start}-${end}/${stats.size}`
    headers['Content-Length'] = String(chunkSize)

    return new Response(webStream, {
      status: 206,
      headers
    })
  }

  const webStream = toWebStream(fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 }))
  headers['Content-Length'] = String(stats.size)

  return new Response(webStream, {
    status: 200,
    headers
  })
}

/**
 * Cleanup old registry entries to free up memory
 */
function runCleanup() {
  const now = Date.now()
  for (const [id, data] of pdfRegistry.entries()) {
    if (now - data.createdAt > MAX_AGE_MS) {
      pdfRegistry.delete(id)
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
        corsEnabled: true,
        bypassCSP: true
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
      if (!fs.existsSync(filePath)) return new Response('Not Found', { status: 404 })

      const stats = await fs.promises.stat(filePath)
      const headers = createPdfResponseHeaders(stats)

      const ifNoneMatch = request.headers.get('if-none-match')
      if (ifNoneMatch === headers.ETag) {
        return new Response(null, {
          status: 304,
          headers
        })
      }

      return createPdfStreamResponse(filePath, stats, request.headers.get('range'))
    } catch (error) {
      console.error('[PDFProtocol] Stream Error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  })
}

export function registerPdfProtocolHandlers() {
  const { IPC_CHANNELS } = APP_CONFIG

  const addToAllowlist = async (filePath: string) => {
    const normalized = normalizePdfPath(filePath)
    await allowListManager.setItem(normalized, true)
  }

  const isAllowed = async (filePath: string) => {
    const normalized = normalizePdfPath(filePath)

    if (sessionAllowedPdfPaths.has(normalized)) return true

    const allowed = await allowListManager.read()
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

  ipcMain.handle(IPC_CHANNELS.SELECT_PDF, async (event, options = {}) => {
    if (!requireTrustedIpcSender(event)) return null

    const filterName = options.filterName || 'PDF Documents'
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: filterName, extensions: ['pdf'] }]
    })

    if (canceled || filePaths.length === 0) return null

    const filePath = filePaths[0]
    try {
      const stats = await fs.promises.stat(filePath)

      // SECURITY: Persist allowlist only for explicit file-picker selection
      await addToAllowlist(filePath)
      const normalized = normalizePdfPath(filePath)
      sessionAllowedPdfPaths.add(normalized)

      const streamUrl = registerPdfPath(filePath)

      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        streamUrl
      }
    } catch (err) {
      console.error('[PDFProtocol] Selection error:', err)
      return null
    }
  })

  ipcMain.handle(IPC_CHANNELS.GET_PDF_STREAM_URL, async (event, filePath) => {
    if (!requireTrustedIpcSender(event)) return null
    if (!filePath) return null

    // SECURITY: Check allowlist and file existence
    try {
      const normalizedPath = normalizePdfPath(filePath)

      // IMPORTANT: Only allow paths that user previously selected OR explicit allows
      // This prevents renderer from requesting arbitrary system files
      if (!(await isAllowed(normalizedPath))) {
        console.warn(
          '[PDFProtocol] Security Warning: Unauthorized PDF access attempt:',
          normalizedPath
        )
        return null
      }

      if (fs.existsSync(normalizedPath) && isPdfFilePath(normalizedPath)) {
        return { streamUrl: registerPdfPath(normalizedPath) }
      }
    } catch (err) {
      console.error('[PDFProtocol] Resolve Error:', err)
    }
    return null
  })

  ipcMain.handle(IPC_CHANNELS.PDF_REGISTER_PATH, async (event, filePath) => {
    if (!requireTrustedIpcSender(event)) return null
    if (!filePath) return null
    try {
      const stats = await fs.promises.stat(filePath)
      if (!isPdfFilePath(filePath)) return null

      const normalized = normalizePdfPath(filePath)
      sessionAllowedPdfPaths.add(normalized)

      return {
        path: normalized,
        name: path.basename(normalized),
        size: stats.size,
        streamUrl: registerPdfPath(normalized)
      }
    } catch (err) {
      console.error('[PDFProtocol] Register error:', err)
      return null
    }
  })
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
