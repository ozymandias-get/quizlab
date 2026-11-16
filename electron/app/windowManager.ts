import { type BrowserWindow } from 'electron'

import { APP_CONFIG } from './constants.js'
import { confirmPendingWrites } from './quitConfirmation.js'
import { isReloadShortcut } from './reloadShortcut.js'
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

  const window = createMainBrowserWindow(windowState)
  mainWindow = window

  hardenWindowWebContents(window)

  // Must be armed before the first load: `loadFile`/`loadURL` resolve on
  // `did-finish-load`, so registering `dom-ready` / `did-finish-load` after
  // awaiting them misses the events they exist to observe and leaves a hidden
  // window waiting for the 10-second fallback timer.
  const clearRevealTimer = configureWindowReveal({
    window,
    iconPath: resolveIconPath(),
    isDev,
    devServerUrl: DEV_SERVER_URL,
    revealTimeoutMs: MAIN_WINDOW_REVEAL_TIMEOUT_MS,
    domReadyRevealDelayMs: MAIN_WINDOW_DOM_READY_REVEAL_DELAY_MS,
    didFinishLoadRevealDelayMs: MAIN_WINDOW_DID_FINISH_LOAD_REVEAL_DELAY_MS
  })

  // Drop the module-level reference as soon as the window goes away, including
  // when it closes while the renderer is still loading. Only a window that is
  // still the current main window may clear it (an old window's late `closed`
  // event must not detach a replacement created by `activate`).
  window.on('closed', () => {
    clearRevealTimer()
    if (mainWindow === window) mainWindow = null
  })

  try {
    await loadRenderer(window)
  } catch (error) {
    // A failed load leaves no renderer to answer a flush. Destroy the window
    // so its `closed` handler clears `mainWindow` and the startup error path
    // can quit without waiting on a phantom flush answer or showing a dialog.
    if (!window.isDestroyed()) window.destroy()
    throw error
  }

  // The window may have closed while the renderer was loading. Its `closed`
  // handler already cleared `mainWindow` and the reveal timer; do not install
  // lifecycle listeners on a dead window or hand it back to callers — the
  // macOS `activate` path calls show() on whatever createWindow returns.
  if (window.isDestroyed()) return null

  if (windowState.isMaximized && !window.isDestroyed()) {
    window.maximize()
  }

  // A close must give the renderer one bounded chance to finish its pending
  // IndexedDB writes; beforeunload alone cannot await them.
  let closeFlushDone = false
  window.on('close', (event) => {
    if (closeFlushDone) return
    event.preventDefault()
    void (async () => {
      // Wait for both the flush decision and the final state write before
      // destroying the window. An unawaited write can be cut short by a fast
      // app quit, losing the last bounds; the flush still starts immediately
      // because the two run in parallel.
      const [mayClose] = await Promise.all([
        confirmPendingWrites(window, 'close'),
        saveWindowState(window)
      ])
      // A second close click joins the same decision; only the first callback
      // may actually close the window.
      if (!mayClose || closeFlushDone) return
      closeFlushDone = true
      if (!window.isDestroyed()) window.close()
    })()
  })
  // A keyboard reload must use the same flush handshake as a close. The
  // renderer's beforeunload cannot await an IndexedDB transaction, and a
  // reload aborts one that is still in flight (verified against Electron).
  const reloadWindow = window
  let reloadFlushInProgress = false
  reloadWindow.webContents.on('before-input-event', (event, input) => {
    if (!isReloadShortcut(input)) return
    // Own the shortcut even when a flush is already running: the default
    // action would tear the renderer down before the write finishes.
    event.preventDefault()
    if (reloadFlushInProgress) return
    reloadFlushInProgress = true
    const ignoreCache = input.shift === true

    void (async () => {
      // Join the same bounded decision as a close or quit. A reload must not
      // keep a private handshake that can overlap the close path and let the
      // window be destroyed while its flush answer is still in flight.
      const mayReload = await confirmPendingWrites(reloadWindow, 'reload')
      reloadFlushInProgress = false
      if (!mayReload || reloadWindow.isDestroyed()) return

      if (ignoreCache) reloadWindow.webContents.reloadIgnoringCache()
      else reloadWindow.webContents.reload()
    })().catch(() => {
      reloadFlushInProgress = false
    })
  })

  setupSessions(getMainWindow)

  return window
}
