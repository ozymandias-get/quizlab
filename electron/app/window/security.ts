import { app, type BrowserWindow, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

import { Logger } from '../../core/logger.js'
import { resolveExternalLink } from '../../core/systemHandlers/externalLinkPolicy.js'
import { DEV_SERVER_ORIGIN, isDev } from './environment.js'

/**
 * Hardening for the app's own renderer document.
 *
 * Remote third-party surfaces (AI provider sites, Google Drive, Gemini web
 * session apps) are no longer `<webview>` guests; they are main-process owned
 * `WebContentsView`s whose policy lives in `remoteContentSecurity.ts`. What is
 * left here is the boundary for the window that hosts the React app itself.
 */

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:'])

export function isSafeExternalUrl(rawUrl: string) {
  if (isDev && DEV_SERVER_ORIGIN) {
    try {
      if (new URL(rawUrl).origin === DEV_SERVER_ORIGIN) return true
    } catch {
      // Unparsable: fall through to the protocol policy below.
    }
  }
  try {
    const parsed = new URL(rawUrl)
    if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return resolveExternalLink(rawUrl).allowed
    }
  } catch {
    return false
  }
  return false
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
    const relativePath = path.relative(distRoot, targetPath)
    return (
      relativePath === '' ||
      (relativePath !== '..' &&
        !relativePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativePath))
    )
  } catch {
    return false
  }
}

async function openExternalUrl(rawUrl: string) {
  try {
    await shell.openExternal(rawUrl)
  } catch (error) {
    Logger.error('[Window] Failed to open external URL:', error)
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

  // SECURITY: Block all certificate errors by default.  This prevents
  // Man-in-the-Middle attacks on loaded content where an attacker could present
  // a forged certificate intercepted via DNS poisoning or proxy.
  // Without this handler, Chromium shows a built-in interstitial page
  // that the app may not render correctly, and the user
  // receives no actionable warning.
  window.webContents.on('certificate-error', (event, _url, _error, _certificate, callback) => {
    event.preventDefault()
    callback(false) // Reject the certificate
  })
}
