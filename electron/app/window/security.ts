import path from 'path'
import { BrowserWindow, app, shell } from 'electron'
import { fileURLToPath } from 'url'
import { DEV_SERVER_ORIGIN, isDev } from './environment'

const ALLOWED_WEBVIEW_PROTOCOLS = new Set(['https:'])

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
