import { app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'

import { APP_CONFIG } from '../constants.js'
import type { WindowState } from './state.js'

const getAppPath = (...parts: string[]) => {
  return path.join(app.getAppPath(), ...parts)
}

export function resolveIconPath() {
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
  const isWindows = process.platform === 'win32'
  const isMac = process.platform === 'darwin'

  return new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: APP_CONFIG.WINDOW.MIN_WIDTH,
    minHeight: APP_CONFIG.WINDOW.MIN_HEIGHT,
    icon: resolveIconPath(),
    autoHideMenuBar: true,
    backgroundColor: '#060608',
    paintWhenInitiallyHidden: true,
    show: false,
    skipTaskbar: true,
    // The app draws its own chrome so the zinc surface reaches the window edge.
    // Linux keeps the native frame: a hidden bar without overlay controls would
    // leave the window unclosable there.
    ...(isWindows || isMac ? { titleBarStyle: 'hidden' as const } : {}),
    ...(isWindows
      ? {
          titleBarOverlay: {
            color: '#060608',
            symbolColor: '#a1a1aa',
            height: 44
          }
        }
      : {}),
    ...(isMac ? { trafficLightPosition: { x: 16, y: 14 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Remote sites are main-process owned WebContentsViews; the renderer has
      // no reason to instantiate an embedded browser of its own.
      webviewTag: false,
      webSecurity: true,
      spellcheck: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      backgroundThrottling: false
    }
  })
}
