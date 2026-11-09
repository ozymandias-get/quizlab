import { type BrowserWindow } from 'electron'

import { APP_CONFIG } from './constants.js'
import { confirmQuitWithPendingWrites } from './quitConfirmation.js'
import {
  DEV_SERVER_URL,
  isDev,
  MAIN_WINDOW_DID_FINISH_LOAD_REVEAL_DELAY_MS,
  MAIN_WINDOW_DOM_READY_REVEAL_DELAY_MS,
  MAIN_WINDOW_REVEAL_TIMEOUT_MS
} from './window/environment.js'
import { loadRenderer } from './window/rendererLoader.js'
import { hardenWindowWebContents } from './window/security.js'
import { setupSessions } from './window/sessions.js'
import { clampWindowStateToDisplay, loadWindowState, saveWindowState } from './window/state.js'
import { createMainBrowserWindow, resolveIconPath } from './window/windows.js'
import { configureWindowReveal } from './windowReveal.js'

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

  // Must be armed before the first load: `loadFile`/`loadURL` resolve on
  // `did-finish-load`, so registering `dom-ready` / `did-finish-load` after
  // awaiting them misses the events they exist to observe and leaves a hidden
  // window waiting for the 10-second fallback timer.
  const clearRevealTimer = configureWindowReveal({
    window: mainWindow,
    iconPath: resolveIconPath(),
    isDev,
    devServerUrl: DEV_SERVER_URL,
    revealTimeoutMs: MAIN_WINDOW_REVEAL_TIMEOUT_MS,
    domReadyRevealDelayMs: MAIN_WINDOW_DOM_READY_REVEAL_DELAY_MS,
    didFinishLoadRevealDelayMs: MAIN_WINDOW_DID_FINISH_LOAD_REVEAL_DELAY_MS
  })

  await loadRenderer(mainWindow)

  if (windowState.isMaximized && !mainWindow.isDestroyed()) {
    mainWindow.maximize()
  }

  // A close must give the renderer one bounded chance to finish its pending
  // IndexedDB writes; beforeunload alone cannot await them.
  let closeFlushDone = false
  mainWindow.on('close', (event) => {
    saveWindowState(mainWindow)
    if (closeFlushDone) return
    event.preventDefault()
    void confirmQuitWithPendingWrites(mainWindow).then((mayClose) => {
      // A second close click joins the same decision; only the first callback
      // may actually close the window.
      if (!mayClose || closeFlushDone) return
      closeFlushDone = true
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close()
    })
  })
  mainWindow.on('closed', () => {
    clearRevealTimer()
    mainWindow = null
  })

  setupSessions(getMainWindow)

  return mainWindow
}
