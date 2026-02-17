
import { BrowserWindow, dialog, session, app, screen } from 'electron'
import path from 'path'
import { APP_CONFIG } from './constants'
import { ConfigManager } from '../core/ConfigManager'

export const isDev = !app.isPackaged
const shouldOpenDevToolsOnStart = process.env.QUIZLAB_OPEN_DEVTOOLS === '1'
const windowStateFile = path.join(app.getPath('userData'), 'window-state.json')

const getAppPath = (...parts: string[]) => {
    return path.join(app.getAppPath(), ...parts)
}



interface WindowState {
    width: number;
    height: number;
    x?: number;
    y?: number;
    isMaximized: boolean;
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
        const bounds = isMaximized && window.getNormalBounds ? window.getNormalBounds() : window.getBounds()

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

    const iconPath = getAppPath('resources', `icon.${process.platform === 'win32' ? 'ico' : 'png'}`)

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
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webviewTag: true,
            webSecurity: true,
            spellcheck: false
        }
    })

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173')
        if (shouldOpenDevToolsOnStart) {
            mainWindow.webContents.openDevTools({ mode: 'detach' })
        }
    } else {
        mainWindow.setMenu(null)
        const indexPath = path.join(app.getAppPath(), 'dist', 'index.html')
        mainWindow.loadFile(indexPath).catch(() => {
            dialog.showErrorBox('Load Error', `Index not found: ${indexPath}`)
        })
    }

    if (windowState.isMaximized) {
        mainWindow.maximize()
    }

    mainWindow.once('ready-to-show', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.destroy()
            splashWindow = null
        }
        mainWindow?.show()
    })

    mainWindow.on('close', () => saveWindowState(mainWindow))
    mainWindow.on('closed', () => { mainWindow = null })

    setupSessions()

    return mainWindow
}



function setupSessions() {
    try {
        const aiSession = session.fromPartition(APP_CONFIG.PARTITIONS.AI)

        aiSession.webRequest.onBeforeSendHeaders((details, callback) => {
            details.requestHeaders['User-Agent'] = APP_CONFIG.CHROME_USER_AGENT
            callback({ requestHeaders: details.requestHeaders })
        })

        aiSession.setPermissionRequestHandler((_webContents, permission, callback) => {
            const allowed = ['notifications', 'media', 'geolocation']
            callback(allowed.includes(permission))
        })
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
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    })

    splashWindow.loadFile(splashPath).catch(() => { })
    splashWindow.on('closed', () => { splashWindow = null })

    return splashWindow
}
