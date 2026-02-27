
import { app, BrowserWindow, dialog } from 'electron'
import {
    registerPdfScheme,
    registerPdfProtocol,
    registerPdfProtocolHandlers,
    startPdfCleanupInterval,
    stopPdfCleanupInterval,
    clearAllPdfPaths
} from '../features/pdf/pdfProtocol'
import {
    createWindow,
    createSplashWindow,
    getSplashWindow,
    getMainWindow,
    isDev
} from './windowManager'
import { registerGeneralHandlers, registerQuizHandlers } from './ipcHandlers'
import { initUpdater } from '../core/updater'

if (process.platform === 'win32') {
    app.setAppUserModelId('com.quizlab.reader')
}

// Disable quota management to prevent database errors
app.commandLine.appendSwitch('disable-features', 'StorageAccessAPI,AutofillServerCommunication')
app.commandLine.appendSwitch('disable-site-isolation-trials')

if (!isDev) {
    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
        app.quit()
        process.exit(0)
    }

    app.on('second-instance', () => {
        const mainWindow = getMainWindow()
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })
}



registerPdfScheme()


app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-parallel-downloading')
app.commandLine.appendSwitch('enable-quic')
// Set higher priority for the renderer process
app.commandLine.appendSwitch('high-dpi-support', '1')
app.commandLine.appendSwitch('force-device-scale-factor', '1')
// NOTE: `disable-features` was already set above. Do not override it here.

// Background task to clean up corrupted storage without blocking startup
async function runBackgroundCleanup() {
    try {
        const userDataPath = app.getPath('userData')
        const fs = require('fs').promises
        const path = require('path')

        const filesToClean = [
            'QuotaManager',
            'QuotaManager-journal'
        ]

        for (const file of filesToClean) {
            const filePath = path.join(userDataPath, file)
            try {
                // Use rm with force: true to safely delete only if it exists
                await fs.rm(filePath, { force: true })
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        console.log('[Startup] Background cleanup finished')
    } catch (e) {
        // Ignore overall errors
    }
}

async function initializeApp() {
    createSplashWindow()

    registerPdfProtocol()
    registerPdfProtocolHandlers()
    registerGeneralHandlers()
    registerQuizHandlers()

    startPdfCleanupInterval()

    await createWindow()

    initUpdater()

    // Start background cleanup without blocking the UI
    runBackgroundCleanup()
}

app.whenReady().then(initializeApp)

app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        const mw = await createWindow()
        mw?.show()
    }
})

app.on('window-all-closed', async () => {
    stopPdfCleanupInterval()
    clearAllPdfPaths()

    // Clear corrupted storage before exit asynchronously
    try {
        const userDataPath = app.getPath('userData')
        const fs = require('fs').promises
        const path = require('path')

        // Remove problematic storage files
        const filesToClean = [
            'QuotaManager',
            'QuotaManager-journal',
            'DIPS',
            'DIPS-journal'
        ]

        await Promise.allSettled(filesToClean.map(async (file: string) => {
            const filePath = path.join(userDataPath, file)
            try {
                await fs.rm(filePath, { force: true })
            } catch (e) {
                // Ignore cleanup errors
            }
        }))
    } catch (e) {
        // Ignore cleanup errors
    }

    if (process.platform !== 'darwin') {
        app.quit()
    }
})



const handleSeriousError = (type: string, error: unknown) => {
    console.error(type, error)

    if (app.isReady()) {
        const message = error instanceof Error ? error.message : String(error)
        dialog.showErrorBox(
            type,
            ` The app encountered a critical error.\n\n` +
            `Error: ${message.slice(0, 500)}`
        )
    }
}

process.on('uncaughtException', (err: unknown) => {
    const code = (err && typeof err === 'object' && 'code' in err) ? (err as NodeJS.ErrnoException).code : undefined
    if (code === 'EPIPE') return
    handleSeriousError('Uncaught Exception', err)
})

process.on('unhandledRejection', (reason: unknown) => {
    handleSeriousError('Unhandled Rejection', reason)
})
