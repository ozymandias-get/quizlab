import { app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'

import { APP_CONFIG } from '../constants'
import type { WindowState } from './state'

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
      backgroundThrottling: false
    }
  })
}
