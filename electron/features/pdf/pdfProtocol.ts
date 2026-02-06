import { protocol, ipcMain, dialog, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { Readable } from 'stream'
import crypto from 'crypto'
import { APP_CONFIG } from '../../main/constants'
import { ConfigManager } from '../../core/ConfigManager'

// Registry to map unique IDs to local file paths
interface PDFData {
    path: string;
    createdAt: number;
}
const pdfRegistry = new Map<string, PDFData>()

// Allowlist persists paths user has intentionally opened
type AllowListMap = Record<string, boolean>
const ALLOWLIST_FILE = path.join(app.getPath('userData'), 'pdf-allowlist.json')
const allowListManager = new ConfigManager<AllowListMap>(ALLOWLIST_FILE)

// Cleanup constants
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

let cleanupInterval: NodeJS.Timeout | null = null

/**
 * Generate a unique ID for the PDF stream
 */
function generateId() {
    return `pdf_${crypto.randomBytes(6).toString('hex')}_${Date.now()}`
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

// ============================================
// PROTOCOL REGISTRATION
// ============================================

export function registerPdfScheme() {
    protocol.registerSchemesAsPrivileged([
        {
            scheme: 'local-pdf',
            privileges: {
                standard: true,
                secure: true,
                supportFetchAPI: true,
                stream: true,
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
            const nodeStream = fs.createReadStream(filePath, { highWaterMark: 128 * 1024 })
            const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>

            return new Response(webStream, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Length': String(stats.size),
                    'Cache-Control': 'private, no-cache',
                    'X-Content-Type-Options': 'nosniff'
                }
            })
        } catch (error) {
            console.error('[PDFProtocol] Stream Error:', error)
            return new Response('Internal Server Error', { status: 500 })
        }
    })
}

// ============================================
// IPC HANDLERS
// ============================================

export function registerPdfProtocolHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG

    const addToAllowlist = async (filePath: string) => {
        const normalized = path.normalize(filePath)
        await allowListManager.setItem(normalized, true)
    }

    const isAllowed = async (filePath: string) => {
        const normalized = path.normalize(filePath)

        // 1. Check explicit allowlist
        const allowed = await allowListManager.read()
        if (allowed[normalized]) return true

        // 2. Allow files in User Data directory (e.g. Library)
        // This ensures the internal Library and other app-managed files are accessible
        try {
            const userDataPath = app.getPath('userData')
            const rel = path.relative(userDataPath, normalized)

            // Check if inside userData (not parent, not absolute/other drive)
            if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
                return true
            }
        } catch (e) {
            console.error('[PDFProtocol] Error checking userData path:', e)
        }

        return false
    }

    // Select PDF via dialog
    ipcMain.handle(IPC_CHANNELS.SELECT_PDF, async (event, options = {}) => {
        const filterName = options.filterName || 'PDF Documents'
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: filterName, extensions: ['pdf'] }]
        })

        if (canceled || filePaths.length === 0) return null

        const filePath = filePaths[0]
        try {
            const stats = await fs.promises.stat(filePath)

            // SECURITY: Add to allowlist
            await addToAllowlist(filePath)

            const id = generateId()
            pdfRegistry.set(id, { path: filePath, createdAt: Date.now() })

            return {
                path: filePath,
                name: path.basename(filePath),
                size: stats.size,
                streamUrl: `local-pdf://${id}`
            }
        } catch (err) {
            console.error('[PDFProtocol] Selection error:', err)
            return null
        }
    })

    // Get stream URL from path (for rehydration or drag-drop)
    ipcMain.handle(IPC_CHANNELS.GET_PDF_STREAM_URL, async (event, filePath) => {
        if (!filePath) return null

        // SECURITY: Check allowlist and file existence
        try {
            const normalizedPath = path.normalize(filePath)

            // IMPORTANT: Only allow paths that user previously selected OR explicit allows
            // This prevents renderer from requesting arbitrary system files
            if (!(await isAllowed(normalizedPath))) {
                console.warn('[PDFProtocol] Security Warning: Unauthorized PDF access attempt:', normalizedPath)
                return null
            }

            if (fs.existsSync(normalizedPath) && normalizedPath.toLowerCase().endsWith('.pdf')) {
                const id = generateId()
                pdfRegistry.set(id, { path: normalizedPath, createdAt: Date.now() })
                return { streamUrl: `local-pdf://${id}` }
            }
        } catch (err) {
            console.error('[PDFProtocol] Resolve Error:', err)
        }
        return null
    })

    // Register PDF path locally (e.g. from drag & drop)
    ipcMain.handle(IPC_CHANNELS.PDF_REGISTER_PATH, async (event, filePath) => {
        if (!filePath) return null
        try {
            const stats = await fs.promises.stat(filePath)
            if (path.extname(filePath).toLowerCase() !== '.pdf') return null

            // Allow this path
            await addToAllowlist(filePath)

            const id = generateId()
            pdfRegistry.set(id, { path: filePath, createdAt: Date.now() })

            return {
                path: filePath,
                name: path.basename(filePath),
                size: stats.size,
                streamUrl: `local-pdf://${id}`
            }
        } catch (err) {
            console.error('[PDFProtocol] Register error:', err)
            return null
        }
    })
}

// ============================================
// LIFECYCLE
// ============================================

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

export const clearAllPdfPaths = () => pdfRegistry.clear()
