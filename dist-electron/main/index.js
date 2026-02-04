"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * QuizLab Reader - Electron Main Process
 */
const electron_1 = require("electron");
const pdfProtocol_1 = require("./pdfProtocol");
const windowManager_1 = require("./windowManager");
const ipcHandlers_1 = require("./ipcHandlers");
const updater_1 = require("./updater");
// ============================================
// SINGLE INSTANCE LOCK
// ============================================
if (!windowManager_1.isDev) {
    const gotTheLock = electron_1.app.requestSingleInstanceLock();
    if (!gotTheLock) {
        electron_1.app.quit();
        process.exit(0);
    }
    electron_1.app.on('second-instance', () => {
        const mainWindow = (0, windowManager_1.getMainWindow)();
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
}
// ============================================
// INITIALIZATION
// ============================================
// Register schemes before app ready
(0, pdfProtocol_1.registerPdfScheme)();
// ============================================
// GPU ACCELERATION & OPTIMIZATION flags
// ============================================
electron_1.app.commandLine.appendSwitch('enable-gpu-rasterization');
electron_1.app.commandLine.appendSwitch('enable-zero-copy');
electron_1.app.commandLine.appendSwitch('ignore-gpu-blocklist');
electron_1.app.commandLine.appendSwitch('enable-parallel-downloading');
electron_1.app.commandLine.appendSwitch('enable-quic');
// Set higher priority for the renderer process
electron_1.app.commandLine.appendSwitch('high-dpi-support', '1');
electron_1.app.commandLine.appendSwitch('force-device-scale-factor', '1');
// Disable Autofill to reduce DevTools noise
electron_1.app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication');
/**
 * Main application entry point
 */
async function initializeApp() {
    // 1. Initial splash screen
    (0, windowManager_1.createSplashWindow)();
    // 2. Protocols and Handlers
    (0, pdfProtocol_1.registerPdfProtocol)();
    (0, pdfProtocol_1.registerPdfHandlers)();
    (0, ipcHandlers_1.registerGeneralHandlers)();
    (0, ipcHandlers_1.registerQuizHandlers)();
    // 3. Background maintenance
    (0, pdfProtocol_1.startPdfCleanupInterval)();
    // 4. Create main window
    (0, windowManager_1.createWindow)();
    // Init update system
    (0, updater_1.initUpdater)();
}
electron_1.app.whenReady().then(initializeApp);
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        const mw = (0, windowManager_1.createWindow)();
        mw?.show();
    }
});
electron_1.app.on('window-all-closed', () => {
    (0, pdfProtocol_1.stopPdfCleanupInterval)();
    (0, pdfProtocol_1.clearAllPdfPaths)();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// ============================================
// GLOBAL ERROR HANDLING
// ============================================
const handleSeriousError = (type, error) => {
    console.error(`${type}:`, error);
    if (electron_1.app.isReady()) {
        const message = error instanceof Error ? error.message : String(error);
        electron_1.dialog.showErrorBox(type, ` The app encountered a critical error.\n\n` +
            `Error: ${message.slice(0, 500)}`);
    }
};
process.on('uncaughtException', (err) => {
    const code = (err && typeof err === 'object' && 'code' in err) ? err.code : undefined;
    if (code === 'EPIPE')
        return;
    handleSeriousError('Uncaught Exception', err);
});
process.on('unhandledRejection', (reason) => {
    handleSeriousError('Unhandled Rejection', reason);
});
