"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllPdfPaths = void 0;
exports.registerPdfScheme = registerPdfScheme;
exports.registerPdfProtocol = registerPdfProtocol;
exports.registerPdfHandlers = registerPdfHandlers;
exports.startPdfCleanupInterval = startPdfCleanupInterval;
exports.stopPdfCleanupInterval = stopPdfCleanupInterval;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const stream_1 = require("stream");
const crypto_1 = __importDefault(require("crypto"));
const constants_1 = require("./constants");
const pdfRegistry = new Map();
// Cleanup constants
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let cleanupInterval = null;
/**
 * Generate a unique ID for the PDF stream
 */
function generateId() {
    return `pdf_${crypto_1.default.randomBytes(6).toString('hex')}_${Date.now()}`;
}
/**
 * Cleanup old registry entries to free up memory
 */
function runCleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [id, data] of pdfRegistry.entries()) {
        if (now - data.createdAt > MAX_AGE_MS) {
            pdfRegistry.delete(id);
            removed++;
        }
    }
}
// ============================================
// PROTOCOL REGISTRATION
// ============================================
function registerPdfScheme() {
    electron_1.protocol.registerSchemesAsPrivileged([
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
    ]);
}
function registerPdfProtocol() {
    electron_1.protocol.handle('local-pdf', async (request) => {
        try {
            const url = new URL(request.url);
            const pdfId = url.host;
            const pdfData = pdfRegistry.get(pdfId);
            if (!pdfData) {
                return new Response('Forbidden', { status: 403 });
            }
            const filePath = pdfData.path;
            if (!fs_1.default.existsSync(filePath)) {
                return new Response('Not Found', { status: 404 });
            }
            const stats = await fs_1.default.promises.stat(filePath);
            const nodeStream = fs_1.default.createReadStream(filePath, { highWaterMark: 128 * 1024 });
            const webStream = stream_1.Readable.toWeb(nodeStream);
            return new Response(webStream, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Length': String(stats.size),
                    'Cache-Control': 'private, no-cache',
                    'X-Content-Type-Options': 'nosniff'
                }
            });
        }
        catch (error) {
            console.error('[PDFProtocol] Stream Error:', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    });
}
// ============================================
// IPC HANDLERS
// ============================================
function registerPdfHandlers() {
    const { IPC_CHANNELS } = constants_1.APP_CONFIG;
    // Allowlist Manager
    // Load persisted allowlist to support rehydration between sessions
    let allowedPaths = new Set();
    const ALLOWLIST_FILE = path_1.default.join(electron_1.app.getPath('userData'), 'pdf-allowlist.json');
    try {
        if (fs_1.default.existsSync(ALLOWLIST_FILE)) {
            const data = JSON.parse(fs_1.default.readFileSync(ALLOWLIST_FILE, 'utf8'));
            if (Array.isArray(data)) {
                allowedPaths = new Set(data);
            }
        }
    }
    catch (e) {
        console.error('[PDFProtocol] Failed to load allowlist:', e);
    }
    const addToAllowlist = (filePath) => {
        try {
            const normalized = path_1.default.normalize(filePath);
            allowedPaths.add(normalized);
            fs_1.default.writeFileSync(ALLOWLIST_FILE, JSON.stringify([...allowedPaths]));
        }
        catch (e) {
            console.error('[PDFProtocol] Failed to save allowlist:', e);
        }
    };
    const isAllowed = (filePath) => {
        return allowedPaths.has(path_1.default.normalize(filePath));
    };
    // Select PDF via dialog
    electron_1.ipcMain.handle(IPC_CHANNELS.SELECT_PDF, async (event, options = {}) => {
        const filterName = options.filterName || 'PDF Documents';
        const { canceled, filePaths } = await electron_1.dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: filterName, extensions: ['pdf'] }]
        });
        if (canceled || filePaths.length === 0)
            return null;
        const filePath = filePaths[0];
        try {
            const stats = await fs_1.default.promises.stat(filePath);
            // SECURITY: Add to allowlist
            addToAllowlist(filePath);
            const id = generateId();
            pdfRegistry.set(id, { path: filePath, createdAt: Date.now() });
            return {
                path: filePath,
                name: path_1.default.basename(filePath),
                size: stats.size,
                streamUrl: `local-pdf://${id}`
            };
        }
        catch (err) {
            console.error('[PDFProtocol] Selection error:', err);
            return null;
        }
    });
    // Get stream URL from path (for rehydration or drag-drop)
    electron_1.ipcMain.handle(IPC_CHANNELS.GET_PDF_STREAM_URL, async (event, filePath) => {
        if (!filePath)
            return null;
        // SECURITY: Check allowlist and file existence
        try {
            const normalizedPath = path_1.default.normalize(filePath);
            // IMPORTANT: Only allow paths that user previously selected OR explicit allows
            // This prevents renderer from requesting arbitrary system files
            if (!isAllowed(normalizedPath)) {
                console.warn('[PDFProtocol] Security Warning: Unauthorized PDF access attempt:', normalizedPath);
                return null;
            }
            if (fs_1.default.existsSync(normalizedPath) && normalizedPath.toLowerCase().endsWith('.pdf')) {
                const id = generateId();
                pdfRegistry.set(id, { path: normalizedPath, createdAt: Date.now() });
                return { streamUrl: `local-pdf://${id}` };
            }
        }
        catch (err) {
            console.error('[PDFProtocol] Resolve Error:', err);
        }
        return null;
    });
    // Register PDF path locally (e.g. from drag & drop)
    electron_1.ipcMain.handle('pdf:register-path', async (event, filePath) => {
        if (!filePath)
            return null;
        try {
            const stats = await fs_1.default.promises.stat(filePath);
            if (path_1.default.extname(filePath).toLowerCase() !== '.pdf')
                return null;
            // Allow this path
            addToAllowlist(filePath);
            const id = generateId();
            pdfRegistry.set(id, { path: filePath, createdAt: Date.now() });
            return {
                path: filePath,
                name: path_1.default.basename(filePath),
                size: stats.size,
                streamUrl: `local-pdf://${id}`
            };
        }
        catch (err) {
            console.error('[PDFProtocol] Register error:', err);
            return null;
        }
    });
}
// ============================================
// LIFECYCLE
// ============================================
function startPdfCleanupInterval() {
    if (!cleanupInterval) {
        cleanupInterval = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
    }
}
function stopPdfCleanupInterval() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}
const clearAllPdfPaths = () => pdfRegistry.clear();
exports.clearAllPdfPaths = clearAllPdfPaths;
