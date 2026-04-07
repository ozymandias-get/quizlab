import fs from 'fs'
import path from 'path'
import { BrowserWindow, app, screen } from 'electron'
import { APP_CONFIG } from '../constants'
import type { WindowState } from './state'
import { isDev } from './environment'

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
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      webSecurity: true,
      spellcheck: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  })
}

export function createSplashBrowserWindow() {
  const splashPath = isDev
    ? path.join(app.getAppPath(), 'src', 'public', 'splash.html')
    : path.join(app.getAppPath(), 'dist', 'splash.html')

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const splashWindow = new BrowserWindow({
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
    icon: resolveIconPath(),
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

  return splashWindow
}
