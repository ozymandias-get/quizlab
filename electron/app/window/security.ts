import { app, type BrowserWindow, session, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

import { Logger } from '../../core/logger.js'
import { DEV_SERVER_ORIGIN, isDev } from './environment.js'
import { isAllowedWebviewPartition } from './permissionPolicy.js'

const ALLOWED_WEBVIEW_PROTOCOLS = new Set(['https:'])

/**
 * Partitions that webviews are allowed to use, derived from the AI registry
 * (see permissionPolicy.isAllowedWebviewPartition). A webview attempting to
 * use any other partition is blocked to prevent renderer-level partition
 * escape. User-added platforms are covered by the `persist:ai_custom_`
 * prefix, which is minted only by the registry handler.
 */

// SECURITY: Script injected into <webview> guest pages to block clipboard
// access that bypasses the Permission API.  The Permission API (navigator.
// clipboard.read/write) is already gated by setPermissionRequestHandler in
// sessions.ts, but document.execCommand('copy'|'cut'|'paste') bypasses that
// entirely and allows cross-partition clipboard leakage — a malicious webview
// can read system clipboard content written by another partition.
const WEBVIEW_CLIPBOARD_PROTECTION_SCRIPT = `
(() => {
  // Block programmatic clipboard access via execCommand
  const origExecCommand = document.execCommand.bind(document);
  document.execCommand = (command, ...args) => {
    const cmd = command.toLowerCase();
    if (cmd === 'copy' || cmd === 'cut' || cmd === 'paste') {
      return false;
    }
    return origExecCommand(command, ...args);
  };

  // Block clipboard events at the document level (catches addEventListener
  // and oncopy/oncut/onpaste attributes set by the page after load).
  ['copy', 'cut', 'paste'].forEach((type) => {
    document.addEventListener(type, (e) => {
      // Allow paste events synthesized by the app's own automation scripts
      // (marked on the event object in the same JS world). These carry the
      // payload in their clipboardData and never touch the system clipboard,
      // so they cannot leak another partition's clipboard content.
      if (e && e.__quizlabInternalPaste) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  });
})();
`

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

export function setupWebviewSecurity(): void {
  setupClipboardProtection()
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
  // Man-in-the-Middle attacks on <webview> loaded content (e.g. custom AI
  // platforms or Gemini Web Sessions) where an attacker could present a
  // forged certificate intercepted via DNS poisoning or proxy.
  // Without this handler, Chromium shows a built-in interstitial page
  // that the embedded webview may not render correctly, and the user
  // receives no actionable warning.
  window.webContents.on('certificate-error', (event, _url, _error, _certificate, callback) => {
    event.preventDefault()
    callback(false) // Reject the certificate
  })

  window.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    if (!isSafeExternalUrl(params.src || '')) {
      event.preventDefault()
      return
    }

    const partition = webPreferences.partition
    if (!isAllowedWebviewPartition(partition)) {
      Logger.warn(
        `[Security] Blocked webview with disallowed partition: ${partition} (src: ${params.src})`
      )
      event.preventDefault()
      return
    }

    // SECURITY: Explicitly strip any preload script the renderer may
    // have injected — this is the most critical webview hardening step
    // because a malicious preload runs with Node.js privileges.
    delete webPreferences.preload
    delete (webPreferences as Record<string, unknown>).preloadURL

    // Force every webview into a sandboxed, isolated context.
    webPreferences.nodeIntegration = false
    webPreferences.nodeIntegrationInSubFrames = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    webPreferences.webSecurity = true
    webPreferences.allowRunningInsecureContent = false
    webPreferences.experimentalFeatures = false
    webPreferences.spellcheck = false

    // Block legacy plugin content (Flash, etc.).
    webPreferences.plugins = false

    // Disable navigation via drag-drop to prevent accidental file: URIs.
    webPreferences.navigateOnDragDrop = false
  })
}

// SECURITY: Intercept every new webContents creation to inject clipboard
// protection into <webview> guest pages.  This must be registered once
// at app startup, not per-window.
let clipboardProtectionRegistered = false

function setupClipboardProtection(): void {
  if (clipboardProtectionRegistered) return
  clipboardProtectionRegistered = true

  const AUTH_DOMAINS = new Set([
    'accounts.google.com',
    'myaccount.google.com',
    'login.microsoftonline.com',
    'login.live.com',
    'login.x.com'
  ])

  function isAuthDomain(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase()
      if (AUTH_DOMAINS.has(hostname)) return true
      return [...AUTH_DOMAINS].some((domain) => hostname.endsWith('.' + domain))
    } catch {
      return false
    }
  }

  app.on('web-contents-created', (_event, wc) => {
    if (wc.getType() !== 'webview') return

    // SECURITY: Intercept window.open() calls from webview guest pages.
    // Without this handler, Electron creates a new unhardened BrowserWindow
    // for each popup — a phishing/ad link could run in a Node-enabled window.
    // Policy:
    //   - http/https popups are routed to the user's default browser via
    //     shell.openExternal (they are never opened as Electron windows), so
    //     OAuth/redirect flows still work without exposing the app runtime.
    //   - every other scheme (file:, javascript:, data:, chrome:, ...) is
    //     denied outright.
    wc.setWindowOpenHandler(({ url }) => {
      try {
        const parsed = new URL(url)
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          void shell.openExternal(url).catch((error) => {
            Logger.error('[Security] Failed to open external popup URL:', error)
          })
        } else {
          Logger.warn(`[Security] Blocked webview popup with disallowed scheme: ${parsed.protocol}`)
        }
      } catch {
        Logger.warn('[Security] Blocked webview popup with invalid URL')
      }
      return { action: 'deny' }
    })

    const isGeminiPartition = wc.session === session.fromPartition('persist:gemini_web_profile')

    // SECURITY: Prevent guest webview from navigating to auth domains.
    // Google blocks sign-in pages in webview environments (ERR_ABORTED),
    // and auth is handled by the Chrome extension anyway.
    //
    // For Google web session apps (persist:gemini_web_profile), open
    // the auth URL in the user's default browser so they can complete
    // sign-in there. The Chrome extension will sync the cookies back
    // into the session partition.
    const redirectExternalNavigation = (event: Electron.Event, url: string) => {
      if (isAuthDomain(url)) {
        event.preventDefault()

        // Open auth domain URLs in the system browser for Google web
        // session apps so the user can complete sign-in there.  The Chrome
        // extension will forward cookies back to the Electron partition.
        if (isGeminiPartition) {
          void shell.openExternal(url).catch(() => {
            // If opening the URL fails (no default browser, etc.)
            // the navigation is already prevented — safe to ignore.
          })
        }
      }
    }
    wc.on('will-navigate', redirectExternalNavigation)
    wc.on('will-redirect', redirectExternalNavigation)

    wc.on('did-finish-load', () => {
      if (wc.isDestroyed()) return
      wc.executeJavaScript(WEBVIEW_CLIPBOARD_PROTECTION_SCRIPT).catch(() => {
        // Script injection failure is non-fatal — the webview still
        // works, but clipboard access via execCommand is not blocked.
        // This can happen if the guest page navigates before the
        // script runs (race harmless — the next did-finish-load will
        // inject into the new page).
      })
    })
  })
}
