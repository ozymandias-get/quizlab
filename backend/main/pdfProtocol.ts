import { protocol, ipcMain, dialog, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { Readable } from 'stream'
import crypto from 'crypto'
import { APP_CONFIG } from './constants'

// Registry to map unique IDs to local file paths
interface PDFData {
    path: string;
    createdAt: number;
}
const pdfRegistry = new Map<string, PDFData>()

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
    let removed = 0
    for (const [id, data] of pdfRegistry.entries()) {
        if (now - data.createdAt > MAX_AGE_MS) {
            pdfRegistry.delete(id)
            removed++
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

            if (!pdfData) {
                return new Response('Forbidden', { status: 403 })
            }

            const filePath = pdfData.path
            if (!fs.existsSync(filePath)) {
                return new Response('Not Found', { status: 404 })
            }

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

export function registerPdfHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG

    // Allowlist Manager
    // Load persisted allowlist to support rehydration between sessions
    let allowedPaths = new Set<string>()
    const ALLOWLIST_FILE = path.join(app.getPath('userData'), 'pdf-allowlist.json')

    try {
        if (fs.existsSync(ALLOWLIST_FILE)) {
            const data = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8'))
            if (Array.isArray(data)) {
                allowedPaths = new Set(data)
            }
        }
    } catch (e) {
        console.error('[PDFProtocol] Failed to load allowlist:', e)
    }

    const addToAllowlist = (filePath: string) => {
        try {
            const normalized = path.normalize(filePath)
            allowedPaths.add(normalized)
            fs.writeFileSync(ALLOWLIST_FILE, JSON.stringify([...allowedPaths]))
        } catch (e) {
            console.error('[PDFProtocol] Failed to save allowlist:', e)
        }
    }

    const isAllowed = (filePath: string) => {
        return allowedPaths.has(path.normalize(filePath))
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
            addToAllowlist(filePath)

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
            if (!isAllowed(normalizedPath)) {
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
    ipcMain.handle('pdf:register-path', async (event, filePath) => {
        if (!filePath) return null
        try {
            const stats = await fs.promises.stat(filePath)
            if (path.extname(filePath).toLowerCase() !== '.pdf') return null

            // Allow this path
            addToAllowlist(filePath)

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
