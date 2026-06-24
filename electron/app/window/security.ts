import { app, type BrowserWindow, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

import { Logger } from '../../core/logger.js'
import { DEV_SERVER_ORIGIN, isDev } from './environment.js'

const ALLOWED_WEBVIEW_PROTOCOLS = new Set(['https:'])

/**
 * Partitions that webviews are allowed to use. Derived from the AI_REGISTRY
 * and GOOGLE_AI_WEB_SESSION_PARTITION. A webview attempting to use any other
 * partition is blocked to prevent renderer-level partition escape.
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
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  });
})();
`

const ALLOWED_WEBVIEW_PARTITIONS = new Set([
  'persist:ai_session',
  'persist:ai_chatgpt',
  'persist:ai_claude',
  'persist:ai_deepseek',
  'persist:ai_qwen',
  'persist:ai_kimi',
  'persist:ai_m365',
  'persist:ai_copilot',
  'persist:ai_grok',
  'persist:ai_huggingchat',
  'persist:ai_manus',
  'persist:ai_mistral',
  'persist:ai_perplexity',
  'persist:gemini_web_profile'
])

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

    // Validate that the webview uses an allowed partition. A renderer-level
    // compromise could attempt to create webviews with arbitrary partitions
    // to escape the permission boundaries set up in sessions.ts.
    // Custom site partitions (persist:ai_custom_*) are allowed dynamically.
    const ALLOWED_CUSTOM_PREFIX = 'persist:ai_custom_'
    const partition = webPreferences.partition as string | undefined
    if (
      partition &&
      !ALLOWED_WEBVIEW_PARTITIONS.has(partition) &&
      !partition.startsWith(ALLOWED_CUSTOM_PREFIX)
    ) {
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

    // Inject clipboard protection script when the webview loads.
    // We cannot access the guest webContents from will-attach-webview,
    // so we rely on the global web-contents-created handler below to
    // inject the script into every guest page that belongs to a webview.
    // The flag ensures we only inject into webview guests, not the
    // main window or popups.
    ;(webPreferences as Record<string, unknown>).__quizlabWebview = true

    // Store the partition so web-contents-created can make
    // partition-aware security decisions (e.g. opening auth
    // domain URLs in the system browser for Google session apps).
    if (partition) {
      ;(webPreferences as Record<string, unknown>).__quizlabPartition = partition
    }
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
    // Only inject into webview guest pages (not the main window).
    // We check for the flag set in will-attach-webview instead of
    // inspecting type-based heuristics.
    if (!(wc as unknown as Record<string, unknown>).__quizlabWebview) return

    // SECURITY: Intercept window.open() calls from webview guest pages.
    // Without this handler, Electron creates a new unhardened BrowserWindow
    // for each popup. We deny all popups here and let the renderer-side
    // new-window event handler decide what to do (load in same webview,
    // open externally, or block).
    wc.setWindowOpenHandler(() => {
      return { action: 'deny' }
    })

    // Read the partition set in will-attach-webview so we can make
    // partition-aware decisions for auth domain navigations.
    const partition = (wc as unknown as Record<string, unknown>).__quizlabPartition as
      | string
      | undefined

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
        if (partition === 'persist:gemini_web_profile') {
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
