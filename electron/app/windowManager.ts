import type { BrowserWindow } from 'electron'

import { APP_CONFIG } from './constants'
import {
  DEV_SERVER_URL,
  isDev,
  MAIN_WINDOW_DID_FINISH_LOAD_REVEAL_DELAY_MS,
  MAIN_WINDOW_DOM_READY_REVEAL_DELAY_MS,
  MAIN_WINDOW_REVEAL_TIMEOUT_MS
} from './window/environment'
import { loadRenderer } from './window/rendererLoader'
import {
  hardenWindowWebContents,
  isAllowedMainFrameUrl,
  isSafeExternalUrl,
  setupWebviewSecurity
} from './window/security'
import { setupSessions } from './window/sessions'
import { clampWindowStateToDisplay, loadWindowState, saveWindowState } from './window/state'
import { createMainBrowserWindow } from './window/windows'
import { configureWindowReveal } from './windowReveal'

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

  // Register the global web-contents-created handler once at startup.
  // This enables clipboard protection and auth domain interception for
  // all <webview> guest pages created throughout the app lifecycle.
  setupWebviewSecurity()

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
    didFinishLoadRevealDelayMs: MAIN_WINDOW_DID_FINISH_LOAD_REVEAL_DELAY_MS
  })

  mainWindow.on('close', () => saveWindowState(mainWindow))
  mainWindow.on('closed', () => {
    clearRevealTimer()
    mainWindow = null
  })

  setupSessions(getMainWindow)

  return mainWindow
}
