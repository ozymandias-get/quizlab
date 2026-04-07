import { BrowserWindow } from 'electron'
import { APP_CONFIG } from './constants'
import { configureWindowReveal } from './windowReveal'
import {
  DEV_SERVER_URL,
  MAIN_WINDOW_DID_FINISH_LOAD_REVEAL_DELAY_MS,
  MAIN_WINDOW_DOM_READY_REVEAL_DELAY_MS,
  MAIN_WINDOW_REVEAL_TIMEOUT_MS,
  isDev
} from './window/environment'
import { loadRenderer } from './window/rendererLoader'
import {
  hardenWindowWebContents,
  isAllowedMainFrameUrl,
  isSafeExternalUrl
} from './window/security'
import { setupSessions } from './window/sessions'
import { clampWindowStateToDisplay, loadWindowState, saveWindowState } from './window/state'
import { createMainBrowserWindow, createSplashBrowserWindow } from './window/windows'

export { hardenWindowWebContents, isAllowedMainFrameUrl, isSafeExternalUrl }

let mainWindow: BrowserWindow | null = null

export function getMainWindow() {
  return mainWindow
}

export async function createWindow() {
  const windowState = await loadWindowState()
  windowState.width = Math.max(APP_CONFIG.WINDOW.MIN_WIDTH, windowState.width)
  windowState.height = Math.max(APP_CONFIG.WINDOW.MIN_HEIGHT, windowState.height)
  clampWindowStateToDisplay(windowState)

  mainWindow = createMainBrowserWindow(windowState)

  hardenWindowWebContents(mainWindow)

  await loadRenderer(mainWindow)

  if (windowState.isMaximized) {
    mainWindow.maximize()
  }

  const clearRevealTimer = configureWindowReveal({
    window: mainWindow,
    isDev,
    devServerUrl: DEV_SERVER_URL,
    revealTimeoutMs: MAIN_WINDOW_REVEAL_TIMEOUT_MS,
    domReadyRevealDelayMs: MAIN_WINDOW_DOM_READY_REVEAL_DELAY_MS,
    didFinishLoadRevealDelayMs: MAIN_WINDOW_DID_FINISH_LOAD_REVEAL_DELAY_MS,
    destroySplashWindow: () => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy()
        splashWindow = null
      }
    }
  })

  mainWindow.on('close', () => saveWindowState(mainWindow))
  mainWindow.on('closed', () => {
    clearRevealTimer()
    mainWindow = null
  })

  setupSessions(getMainWindow)

  return mainWindow
}

let splashWindow: BrowserWindow | null = null

export function getSplashWindow() {
  return splashWindow
}

export function createSplashWindow() {
  splashWindow = createSplashBrowserWindow()
  splashWindow.once('ready-to-show', () => {
    splashWindow?.show()
  })
  splashWindow.on('closed', () => {
    splashWindow = null
  })

  return splashWindow
}
