import { BrowserWindow, dialog, session, app, screen, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { APP_CONFIG } from './constants'
import { ConfigManager } from '../core/ConfigManager'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from '../features/ai/aiManager'

export const isDev = !app.isPackaged
const DEV_SERVER_URL = process.env.QUIZLAB_RENDERER_URL || 'http://localhost:5173'
const DEV_SERVER_TIMEOUT_MS = 30000
const DEV_SERVER_POLL_MS = 500
const MAIN_WINDOW_REVEAL_TIMEOUT_MS = 10000
const MAIN_WINDOW_DOM_READY_REVEAL_DELAY_MS = 100
const MAIN_WINDOW_DID_FINISH_LOAD_REVEAL_DELAY_MS = 250
const shouldOpenDevToolsOnStart = process.env.QUIZLAB_OPEN_DEVTOOLS === '1'
const windowStateFile = path.join(app.getPath('userData'), 'window-state.json')
const ALLOWED_DEFAULT_PERMISSIONS = new Set(['notifications', 'media'])
const ALLOWED_AI_PERMISSIONS = new Set(['notifications', 'media', 'geolocation'])
const ALLOWED_WEBVIEW_PROTOCOLS = new Set(['https:'])
const DEV_SERVER_ORIGIN = (() => {
  try {
    return new URL(DEV_SERVER_URL).origin
  } catch {
    return null
  }
})()

let sessionsConfigured = false

const getAppPath = (...parts: string[]) => {
  return path.join(app.getAppPath(), ...parts)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function resolveIconPath() {
  const extension = process.platform === 'win32' ? 'ico' : 'png'
  const iconName = `icon.${extension}`
  const candidates = [
    path.join(process.resourcesPath, 'resources', iconName),
    getAppPath('resources', iconName),
    path.join(app.getAppPath(), '..', 'resources', iconName)
  ]

  return candidates.find((iconPath) => fs.existsSync(iconPath)) ?? candidates[0]
}

async function isDevServerReachable() {
  let timeoutId: NodeJS.Timeout | null = null
  try {
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), 1500)
    const response = await fetch(DEV_SERVER_URL, {
      signal: controller.signal,
      headers: { Accept: 'text/html' }
    })
    return response.ok
  } catch {
    return false
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

async function waitForDevServer() {
  const startedAt = Date.now()

  while (Date.now() - startedAt < DEV_SERVER_TIMEOUT_MS) {
    if (await isDevServerReachable()) {
      return true
    }
    await sleep(DEV_SERVER_POLL_MS)
  }

  return false
}

export function isSafeExternalUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl)
    if (isDev && DEV_SERVER_ORIGIN && parsed.origin === DEV_SERVER_ORIGIN) return true
    return ALLOWED_WEBVIEW_PROTOCOLS.has(parsed.protocol)
  } catch {
    return false
  }
}

export function isAllowedMainFrameUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl)

    if (isDev) {
      return DEV_SERVER_ORIGIN !== null && parsed.origin === DEV_SERVER_ORIGIN
    }

    if (parsed.protocol !== 'file:') {
      return false
    }

    const targetPath = path.normalize(fileURLToPath(parsed))
    const distRoot = path.normalize(path.join(app.getAppPath(), 'dist'))
    return targetPath.startsWith(distRoot)
  } catch {
    return false
  }
}

async function openExternalUrl(rawUrl: string) {
  try {
    await shell.openExternal(rawUrl)
  } catch (error) {
    console.error('[Window] Failed to open external URL:', error)
  }
}

export function hardenWindowWebContents(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void openExternalUrl(url)
    }

    return { action: 'deny' }
  })

  const redirectExternalNavigation = (event: Electron.Event, url: string) => {
    if (isAllowedMainFrameUrl(url)) return

    event.preventDefault()
    if (isSafeExternalUrl(url)) {
      void openExternalUrl(url)
    }
  }

  window.webContents.on('will-navigate', redirectExternalNavigation)
  window.webContents.on('will-redirect', redirectExternalNavigation)

  window.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    if (!isSafeExternalUrl(params.src || '')) {
      event.preventDefault()
      return
    }

    // Never inherit host window privileges into guest content.
    delete webPreferences.preload
    delete (webPreferences as Record<string, unknown>).preloadURL
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    webPreferences.webSecurity = true
    webPreferences.allowRunningInsecureContent = false
    webPreferences.experimentalFeatures = false
    webPreferences.spellcheck = false
  })
}

async function loadRenderer(window: BrowserWindow) {
  if (!isDev) {
    window.setMenu(null)
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html')
    await window.loadFile(indexPath).catch(() => {
      dialog.showErrorBox('Load Error', `Index not found: ${indexPath}`)
    })
    return
  }

  const devServerReady = await waitForDevServer()
  if (!devServerReady) {
    throw new Error(
      `Renderer dev server was not reachable at ${DEV_SERVER_URL} within ${DEV_SERVER_TIMEOUT_MS / 1000} seconds. ` +
        'Start the app with `npm run dev`, or run `npm run dev:web` before `npm run dev:electron`.'
    )
  }

  await window.loadURL(DEV_SERVER_URL)
  if (shouldOpenDevToolsOnStart) {
    window.webContents.openDevTools({ mode: 'detach' })
  }
}

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

const windowStateManager = new ConfigManager<WindowState>(windowStateFile)

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toOptionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function clampWindowStateToDisplay(windowState: WindowState) {
  if (windowState.x === undefined || windowState.y === undefined) return

  const display = screen.getDisplayMatching(windowState as Electron.Rectangle)
  if (!display) {
    windowState.x = undefined
    windowState.y = undefined
    return
  }

  const { workArea } = display

  if (windowState.width > workArea.width) windowState.width = workArea.width
  if (windowState.height > workArea.height) windowState.height = workArea.height

  if (windowState.x + windowState.width > workArea.x + workArea.width) {
    windowState.x = workArea.x + workArea.width - windowState.width
  }
  if (windowState.x < workArea.x) {
    windowState.x = workArea.x
  }

  if (windowState.y + windowState.height > workArea.y + workArea.height) {
    windowState.y = workArea.y + workArea.height - windowState.height
  }
  if (windowState.y < workArea.y) {
    windowState.y = workArea.y
  }
}

function getDefaultWindowState(): WindowState {
  return {
    width: APP_CONFIG.WINDOW.DEFAULT_WIDTH,
    height: APP_CONFIG.WINDOW.DEFAULT_HEIGHT,
    isMaximized: false
  }
}

async function loadWindowState(): Promise<WindowState> {
  const stored = await windowStateManager.read()
  const defaults = getDefaultWindowState()
  const merged = { ...defaults, ...stored }

  return {
    width: toFiniteNumber(merged.width, defaults.width),
    height: toFiniteNumber(merged.height, defaults.height),
    x: toOptionalFiniteNumber(merged.x),
    y: toOptionalFiniteNumber(merged.y),
    isMaximized: typeof merged.isMaximized === 'boolean' ? merged.isMaximized : defaults.isMaximized
  }
}

async function saveWindowState(window: BrowserWindow | null) {
  try {
    if (!window || window.isDestroyed()) return

    const isMaximized = window.isMaximized()
    // Use normalBounds if maximized to restore to proper size
    const bounds =
      isMaximized && window.getNormalBounds ? window.getNormalBounds() : window.getBounds()

    await windowStateManager.write({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized
    })
  } catch (error) {
    console.warn('[WindowState] Save error:', error)
  }
}

// ============================================
// MAIN WINDOW
// ============================================
let mainWindow: BrowserWindow | null = null

export function getMainWindow() {
  return mainWindow
}

export async function createWindow() {
  const windowState = await loadWindowState()
  windowState.width = Math.max(APP_CONFIG.WINDOW.MIN_WIDTH, windowState.width)
  windowState.height = Math.max(APP_CONFIG.WINDOW.MIN_HEIGHT, windowState.height)
  clampWindowStateToDisplay(windowState)

  const iconPath = resolveIconPath()

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: APP_CONFIG.WINDOW.MIN_WIDTH,
    minHeight: APP_CONFIG.WINDOW.MIN_HEIGHT,
    icon: iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#0c0a09',
    paintWhenInitiallyHidden: true,
    show: false,
    // Hide from taskbar during boot to avoid dual-preview with splash.
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      webSecurity: true,
      spellcheck: false,
      // Prevent storage/quota issues
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  })

  hardenWindowWebContents(mainWindow)

  await loadRenderer(mainWindow)

  if (windowState.isMaximized) {
    mainWindow.maximize()
  }

  let revealTimer: NodeJS.Timeout | null = null
  let hasRevealedMainWindow = false

  const clearRevealTimer = () => {
    if (!revealTimer) return
    clearTimeout(revealTimer)
    revealTimer = null
  }

  const revealMainWindow = (
    reason: 'dom-ready' | 'did-fail-load' | 'did-finish-load' | 'ready-to-show' | 'timeout'
  ) => {
    if (hasRevealedMainWindow) return
    hasRevealedMainWindow = true
    clearRevealTimer()
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (reason === 'timeout' && mainWindow.webContents.isLoadingMainFrame()) {
      console.warn(
        '[Window] Main window did not report readiness in time; revealing it as a fallback.'
      )
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy()
      splashWindow = null
    }
    mainWindow.setSkipTaskbar(false)
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
  }

  const scheduleReveal = (reason: 'dom-ready' | 'did-finish-load', delayMs: number) => {
    setTimeout(() => {
      revealMainWindow(reason)
    }, delayMs)
  }

  revealTimer = setTimeout(() => {
    revealMainWindow('timeout')
  }, MAIN_WINDOW_REVEAL_TIMEOUT_MS)

  mainWindow.once('ready-to-show', () => revealMainWindow('ready-to-show'))
  mainWindow.webContents.once('dom-ready', () => {
    scheduleReveal('dom-ready', MAIN_WINDOW_DOM_READY_REVEAL_DELAY_MS)
  })
  mainWindow.webContents.once('did-finish-load', () => {
    scheduleReveal('did-finish-load', MAIN_WINDOW_DID_FINISH_LOAD_REVEAL_DELAY_MS)
  })
  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return
      console.error(
        `[Window] Failed to load ${validatedURL || 'main window'} (${errorCode}): ${errorDescription}`
      )
      revealMainWindow('did-fail-load')
      const isDevRendererFailure = isDev && (validatedURL || '').startsWith(DEV_SERVER_URL)
      dialog.showErrorBox(
        isDevRendererFailure ? 'Renderer Dev Server Unavailable' : 'Load Error',
        isDevRendererFailure
          ? `Failed to load the renderer from ${validatedURL || DEV_SERVER_URL}.\n\n` +
              `${errorDescription} (${errorCode})\n\n` +
              'Run `npm run dev` to start both Vite and Electron, or start Vite with `npm run dev:web` before `npm run dev:electron`.'
          : `Failed to load ${validatedURL || 'the main window'}.\n\n${errorDescription} (${errorCode})`
      )
    }
  )

  mainWindow.on('close', () => saveWindowState(mainWindow))
  mainWindow.on('closed', () => {
    clearRevealTimer()
    mainWindow = null
  })

  setupSessions()

  return mainWindow
}

function setupSessions() {
  if (sessionsConfigured) return

  try {
    // Configure default session to prevent quota database errors
    const defaultSession = session.defaultSession
    if (defaultSession) {
      defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(ALLOWED_DEFAULT_PERMISSIONS.has(permission))
      })
      defaultSession.setPermissionCheckHandler((_webContents, permission) =>
        ALLOWED_DEFAULT_PERMISSIONS.has(permission)
      )
    }

    const aiPartitions = new Set<string>()
    if (APP_CONFIG.PARTITIONS.AI) aiPartitions.add(APP_CONFIG.PARTITIONS.AI)
    Object.values(AI_REGISTRY).forEach((p) => p.partition && aiPartitions.add(p.partition))

    // Optionally apply it to inactive platforms too in case users had a session before
    Object.values(INACTIVE_PLATFORMS).forEach((p) => p.partition && aiPartitions.add(p.partition))

    for (const partition of aiPartitions) {
      const aiSession = session.fromPartition(partition)

      aiSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = APP_CONFIG.CHROME_USER_AGENT
        callback({ requestHeaders: details.requestHeaders })
      })

      aiSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(ALLOWED_AI_PERMISSIONS.has(permission))
      })
      aiSession.setPermissionCheckHandler((_webContents, permission) =>
        ALLOWED_AI_PERMISSIONS.has(permission)
      )
    }

    sessionsConfigured = true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[Sessions] Error:`, message)
  }
}

let splashWindow: BrowserWindow | null = null

export function getSplashWindow() {
  return splashWindow
}

export function createSplashWindow() {
  const splashPath = isDev
    ? path.join(app.getAppPath(), 'src', 'public', 'splash.html')
    : path.join(app.getAppPath(), 'dist', 'splash.html')

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const iconPath = resolveIconPath()

  splashWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    center: false,
    show: false,
    skipTaskbar: true,
    focusable: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  splashWindow
    .loadFile(splashPath, {
      query: {
        version: app.getVersion()
      }
    })
    .catch(() => {})
  splashWindow.once('ready-to-show', () => {
    splashWindow?.show()
  })
  splashWindow.on('closed', () => {
    splashWindow = null
  })

  return splashWindow
}
