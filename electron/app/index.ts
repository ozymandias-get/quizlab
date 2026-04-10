import { app, BrowserWindow, dialog } from 'electron'
import {
  registerPdfScheme,
  registerPdfProtocol,
  registerPdfProtocolHandlers,
  startPdfCleanupInterval,
  stopPdfCleanupInterval,
  clearAllPdfPaths
} from '../features/pdf/pdfProtocol'
import { createWindow, createSplashWindow, getMainWindow } from './windowManager'
import { registerGeneralHandlers } from './ipcHandlers'
import { initUpdater } from '../core/updater'
import { shutdownGeminiWebSessionHandlers } from '../features/gemini-web-session/handlers'

if (process.platform === 'win32') {
  app.setAppUserModelId('com.quizlab.reader')
}

app.commandLine.appendSwitch(
  'disable-features',
  'StorageAccessAPI,AutofillServerCommunication,VaapiVideoDecoder,VaapiVideoEncoder,CalculateNativeWinOcclusion'
)
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization')
app.commandLine.appendSwitch('disable-site-isolation-trials')

const allowMultiInstance = process.env.APP_ALLOW_MULTI_INSTANCE === '1'

if (!allowMultiInstance) {
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

app.commandLine.appendSwitch('log-level', '3')

app.commandLine.appendSwitch('high-dpi-support', '1')

let appCleanupPromise: Promise<void> | null = null
let appCleanupComplete = false
let quitAfterCleanup = false

async function performAppCleanup() {
  if (appCleanupComplete) return
  if (appCleanupPromise) {
    await appCleanupPromise
    return
  }

  appCleanupPromise = (async () => {
    stopPdfCleanupInterval()
    clearAllPdfPaths()
    await shutdownGeminiWebSessionHandlers()
    appCleanupComplete = true
  })()
    .catch((error) => {
      console.error('[App] Cleanup failed:', error)
    })
    .finally(() => {
      appCleanupPromise = null
    })

  await appCleanupPromise
}

async function initializeApp() {
  createSplashWindow()

  registerPdfProtocol()
  registerPdfProtocolHandlers()
  registerGeneralHandlers()

  startPdfCleanupInterval()

  await createWindow()

  initUpdater()
}

app.whenReady().then(() => {
  void initializeApp().catch((error) => {
    handleSeriousError('Startup Failure', error)
    app.quit()
  })
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      const mw = await createWindow()
      mw?.show()
    } catch (error) {
      handleSeriousError('Window Activation Failure', error)
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  if (quitAfterCleanup) return
  event.preventDefault()
  void performAppCleanup().finally(() => {
    quitAfterCleanup = true
    app.quit()
  })
})

const handleSeriousError = (type: string, error: unknown) => {
  console.error(type, error)

  if (app.isReady()) {
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox(
      type,
      ` The app encountered a critical error.\n\n` + `Error: ${message.slice(0, 500)}`
    )
  }
}

function isWebviewNavigationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? (error as NodeJS.ErrnoException).code : undefined
  if (code === 'ERR_ABORTED') return true
  const message = error instanceof Error ? error.message : ''
  return message.includes('GUEST_VIEW_MANAGER_CALL')
}

process.on('uncaughtException', (err: unknown) => {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? (err as NodeJS.ErrnoException).code
      : undefined
  if (code === 'EPIPE') return
  if (isWebviewNavigationError(err)) return
  handleSeriousError('Uncaught Exception', err)
})

process.on('unhandledRejection', (reason: unknown) => {
  if (isWebviewNavigationError(reason)) return
  handleSeriousError('Unhandled Rejection', reason)
})
