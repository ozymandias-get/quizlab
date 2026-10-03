import { app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'

import { APP_CONFIG } from '../constants.js'
import type { WindowState } from './state.js'

const getAppPath = (...parts: string[]) => {
  return path.join(app.getAppPath(), ...parts)
}

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

/**
 * Resolve the icon path for picker windows (display media, etc.).
 * Shared resolution logic used by both main window and picker windows.
 */
export function resolvePickerIconPath(): string | undefined {
  return resolveIconPath()
}

export function createMainBrowserWindow(windowState: WindowState): BrowserWindow {
  return new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: APP_CONFIG.WINDOW.MIN_WIDTH,
    minHeight: APP_CONFIG.WINDOW.MIN_HEIGHT,
    icon: resolveIconPath(),
    autoHideMenuBar: true,
    backgroundColor: '#0c0a09',
    paintWhenInitiallyHidden: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
      webSecurity: true,
      spellcheck: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // `backgroundThrottling` is deliberately left at the Chromium/Electron
      // default (`true`). It was previously hard-disabled here, which per the
      // Electron docs defeated two things this app depends on:
      //
      //  1. "When at least one webContents displayed in a single browserWindow
      //     has disabled backgroundThrottling then frames will be drawn and
      //     swapped for the whole window and other webContents displayed by
      //     it." — so every hidden/sleeping AI guest webview (which declares
      //     `backgroundThrottling=yes` in AiSession.tsx) kept getting frames
      //     produced and swapped while the window was in the background.
      //  2. "This also affects the Page Visibility API." — `document.hidden`
      //     never became true, so every `visibilitychange` consumer in the
      //     renderer was dead: AppEffects' pauseAmbientAnimations(),
      //     the bottom-bar particle canvas, AestheticLoader's interval, and
      //     the reading-progress / zustand persistence flushes.
      //
      // Restoring the default stops the ambient blur animations, the particle
      // canvas and the PDF/React shell from producing frames while the window
      // is not in the foreground, which is what caused the cumulative
      // CPU/GPU saturation users saw after extended use.
      backgroundThrottling: true
    }
  })
}
