
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
// Disable Autofill to reduce DevTools noise
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication')

async function initializeApp() {
    createSplashWindow()

    registerPdfProtocol()
    registerPdfProtocolHandlers()
    registerGeneralHandlers()
    registerQuizHandlers()

    startPdfCleanupInterval()

    await createWindow()

    initUpdater()
}

app.whenReady().then(initializeApp)

app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        const mw = await createWindow()
        mw?.show()
    }
})

app.on('window-all-closed', () => {
    stopPdfCleanupInterval()
    clearAllPdfPaths()

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
