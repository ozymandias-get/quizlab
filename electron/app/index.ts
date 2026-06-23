import { app, BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

import { registerCleanup, runCleanup } from '../core/appCleanup'
import { runStartupCleanup } from '../core/cacheCleanup'
import { startCacheScheduler, stopCacheScheduler } from '../core/cacheScheduler'
import { createIssueLogReport, flushToDisk, initLogger, Logger } from '../core/logger'
import { initUpdater } from '../core/updater'
import { shutdownGeminiWebSessionHandlers } from '../features/gemini-web-session/handlers'
import {
  clearAllPdfPaths,
  registerPdfProtocol,
  registerPdfProtocolHandlers,
  registerPdfScheme,
  startPdfCleanupInterval,
  stopPdfCleanupInterval
} from '../features/pdf/pdfProtocol'
import { registerGeneralHandlers } from './ipcHandlers'
import { initializeNativeMessaging, shutdownNativeMessaging } from './ipcHandlers'
import { getProfileName, resolveUserDataProfile } from './userDataProfile'
import { createWindow, getMainWindow } from './windowManager'

if (process.platform === 'win32') {
  app.setAppUserModelId('com.quizlab.reader')
}

resolveUserDataProfile()

app.commandLine.appendSwitch(
  'disable-features',
  'StorageAccessAPI,AutofillServerCommunication,VaapiVideoDecoder,VaapiVideoEncoder,CalculateNativeWinOcclusion,Vulkan'
)
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization')
app.commandLine.appendSwitch('disable-site-isolation-trials')

if (getProfileName() === 'stable') {
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
app.commandLine.appendSwitch('enable-accelerated-2d-canvas')
app.commandLine.appendSwitch('enable-zero-copy')
// Note: ignore-gpu-blocklist omitted intentionally — it causes
// SharedImageManager::ProduceSkia mailbox errors on Linux/ANGLE
app.commandLine.appendSwitch('enable-parallel-downloading')
app.commandLine.appendSwitch('enable-quic')
app.commandLine.appendSwitch('disable-gpu-process-crash-limit')

if (process.env.QUIZLAB_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration()
}

app.commandLine.appendSwitch('log-level', '3')

app.commandLine.appendSwitch('high-dpi-support', '1')

let quitAfterCleanup = false

async function initializeApp() {
  initLogger({ userDataPath: app.getPath('userData'), logToDisk: true })
  registerGeneralHandlers()

  // SECURITY: Register the shared cleanup function so that both the
  // before-quit event and the APP_QUIT IPC handler run the same
  // orderly shutdown sequence before the process terminates.
  registerCleanup(async () => {
    stopPdfCleanupInterval()
    stopCacheScheduler()
    clearAllPdfPaths()
    await shutdownGeminiWebSessionHandlers()
    await shutdownNativeMessaging()
    await flushToDisk()
  })

  registerPdfProtocol()
  registerPdfProtocolHandlers()

  startPdfCleanupInterval()

  await initializeNativeMessaging()
  await createWindow()

  initUpdater()

  setTimeout(async () => {
    await runStartupCleanup().catch((error) => {
      Logger.error('[App] Startup cache cleanup failed:', error)
    })

    // Migration: Eski Playwright profil dizinini temizle (artık kullanılmıyor)
    const oldPlaywrightProfile = path.join(app.getPath('userData'), 'gemini-web-login-browser')
    await fs.rm(oldPlaywrightProfile, { recursive: true, force: true }).catch(() => {})
  }, 5000)

  // Periyodik önbellek temizliği: foreground 15dk, idle 30dk tekrar
  startCacheScheduler()
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
  void runCleanup().finally(() => {
    quitAfterCleanup = true
    app.quit()
  })
})

function handleSeriousError(type: string, error: unknown) {
  Logger.error(type, error)

  // Flush logs to disk before showing error dialog
  flushToDisk().catch(() => {})

  // Save crash report
  saveCrashReport(type, error).catch(() => {})

  if (app.isReady()) {
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox(
      type,
      ` The app encountered a critical error.\n\n` + `Error: ${message.slice(0, 500)}`
    )
  }
}

async function saveCrashReport(type: string, error: unknown): Promise<void> {
  let fs: any, path: any
  try {
    fs = require('fs')
    path = require('path')
  } catch {
    return
  }

  const userDataPath = app.getPath('userData')
  const logsDir = path.join(userDataPath, 'logs')
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : ''
  const now = new Date().toISOString()

  const report = createIssueLogReport({
    appVersion: app.getVersion(),
    language: app.getLocale()
  })

  const crashReport = [
    `# Crash Report: ${type}`,
    `- Timestamp: ${now}`,
    `- Error: ${errorMessage}`,
    errorStack ? `\`\`\`\n${errorStack}\n\`\`\`` : '',
    '',
    '## App Logs',
    report
  ].join('\n')

  const crashFile = path.join(logsDir, `crash-${now.replaceAll(/[.:]/g, '-')}.md`)
  fs.writeFileSync(crashFile, crashReport, 'utf-8')
}

function isWebviewNavigationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? (error as NodeJS.ErrnoException).code : undefined
  if (code === 'ERR_ABORTED') return true
  const errno = 'errno' in error ? (error as NodeJS.ErrnoException).errno : undefined
  if (errno === -3) return true
  const message = error instanceof Error ? error.message : ''
  return (
    message.includes('GUEST_VIEW_MANAGER_CALL') ||
    message.includes('Render frame was disposed before WebFrameMain could be accessed')
  )
}

process.on('uncaughtException', (err: unknown) => {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? (err as NodeJS.ErrnoException).code
      : undefined
  if (code === 'EPIPE') return
  if (isWebviewNavigationError(err)) {
    Logger.warn('[App] Suppressed webview navigation error:', err)
    return
  }
  handleSeriousError('Uncaught Exception', err)
})

process.on('unhandledRejection', (reason: unknown) => {
  if (isWebviewNavigationError(reason)) {
    Logger.warn('[App] Suppressed webview navigation rejection:', reason)
    return
  }
  handleSeriousError('Unhandled Rejection', reason)
})
