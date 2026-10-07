import { shell, type WebContents } from 'electron'

import { Logger } from '../../core/logger.js'
import { resolveExternalLink } from '../../core/systemHandlers/externalLinkPolicy.js'
import { PROFILE_PARTITION } from '../../features/gemini-web-session/sessionConfig.js'

/**
 * Security policy shared by every remote surface the app embeds (AI provider
 * sites, the Google Drive panel, Gemini web session apps).
 *
 * These surfaces run untrusted third-party pages. The renderer never reaches
 * their `WebContents` directly — it addresses them by view id through
 * `AiWebContentsViewManager`, which builds each `WebContentsView` with a locked
 * down `webPreferences` block and applies the policies below. That replaces the
 * old `<webview>` `will-attach-webview` gate, which no longer fires once
 * `webviewTag` is disabled.
 */

// SECURITY: Script injected into every remote guest page to block clipboard
// access that bypasses the Permission API.  The Permission API (navigator.
// clipboard.read/write) is already gated by setPermissionRequestHandler in
// sessions.ts, but document.execCommand('copy'|'cut'|'paste') bypasses that
// entirely and allows cross-partition clipboard leakage — a malicious remote
// page can read system clipboard content written by another partition.
// Exported for tests: the paste/copy policy is a security boundary and must be
// pinned by unit tests rather than only by end-to-end behaviour.
export const REMOTE_CONTENT_CLIPBOARD_PROTECTION_SCRIPT = `
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
  //
  // Only UNTRUSTED events are blocked. \`isTrusted\` cannot be forged by page
  // script, so this still prevents a malicious remote page from reading the
  // system clipboard programmatically (synthetic events and execCommand stay
  // blocked above), while allowing genuine user/app pastes through. Blocking
  // trusted events broke the "send page as image to AI" flow: the app writes a
  // real image to the clipboard and calls webContents.paste(), which the browser
  // marks trusted, but the guest page never saw the event and the send button
  // stayed aria-disabled.
  ['copy', 'cut', 'paste'].forEach((type) => {
    document.addEventListener(type, (e) => {
      // Allow paste events synthesized by the app's own automation scripts
      // (marked on the event object in the same JS world). These carry the
      // payload in their clipboardData and never touch the system clipboard,
      // so they cannot leak another partition's clipboard content.
      if (e && e.__quizlabInternalPaste) return;
      // A trusted event originated in the browser: the user pressed the
      // shortcut, or the main process invoked a paste command.
      if (e && e.isTrusted) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  });
})();
`

/**
 * Hosts that must never be navigated to from inside an embedded page.
 *
 * Google refuses to render sign-in pages in embedded engines (ERR_ABORTED), and
 * the OAuth hand-off is handled by the native-messaging Chrome extension which
 * syncs the resulting cookies back into the session partition.
 */
const AUTH_NAVIGATION_DOMAINS = new Set([
  'accounts.google.com',
  'myaccount.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'login.x.com'
])

export function isAuthNavigationDomain(rawUrl: string): boolean {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase()
    if (AUTH_NAVIGATION_DOMAINS.has(hostname)) return true
    return [...AUTH_NAVIGATION_DOMAINS].some((domain) => hostname.endsWith('.' + domain))
  } catch {
    return false
  }
}

export interface RemoteContentSecurityOptions {
  webContents: WebContents
  /** Session partition the view runs in; decides the Google auth hand-off. */
  partition: string
}

/**
 * Schemes a remote surface is ever allowed to be *navigated* to.
 *
 * This is a scheme allowlist, not an origin check: provider sites legitimately
 * move between origins while signing in (`auth.<provider>`, consent pages), and
 * pinning main-frame navigation to the registered origin would break login. The
 * origin side of the boundary is enforced elsewhere — renderer-initiated loads go
 * through `isUrlTrustedForTarget`, and an untrusted origin inside the partition
 * is denied every web permission by `permissionPolicy`.
 *
 * `https:` is the only allowed scheme, and that is not an assumption about the
 * provider registry: every URL the app can put into a managed view is already
 * required to be https before it gets here. `AiViewTargets.toTarget` rejects a
 * built-in or custom platform whose registry URL is not https, the Google web
 * app table does the same, `isUrlTrustedForTarget` rejects a restored or
 * renderer-requested URL that is not https, and `resolveExternalLink` — which
 * decides what leaves for the user's browser — allows only `https:` and
 * `mailto:`. There is therefore no flow that needs `http:`, and the one place a
 * loopback origin does appear (`DEV_SERVER_URL`, the app's own document in the
 * default session) is not a managed view and never reaches this guard.
 *
 * `file:`, `http:`, `javascript:`, `data:`, `blob:`, `chrome:` and `devtools:`
 * are refused. `http:` in particular is a downgrade of a provider session's
 * transport, which is the one thing a scheme allowlist exists to prevent.
 *
 * Does not apply to `loadURL` from the main process: Chromium does not raise
 * `will-navigate` for programmatic loads, and the initial entry URL plus every
 * later renderer request are validated against the partition policy instead.
 */
export function isAllowedRemoteNavigationScheme(rawUrl: string): boolean {
  try {
    const { protocol } = new URL(rawUrl)
    return protocol === 'https:'
  } catch {
    return false
  }
}

export function applyRemoteContentSecurity({
  webContents,
  partition
}: RemoteContentSecurityOptions): void {
  // SECURITY: Intercept window.open() / target="_blank" from embedded pages.
  // Without this handler Electron creates a new unhardened BrowserWindow for
  // each popup — a phishing or ad link could run outside every policy here.
  // Only https links reach the operating system, and they are always opened
  // with the user's default browser rather than inside the app runtime.
  // file:, javascript:, data:, chrome: and every other scheme are denied.
  webContents.setWindowOpenHandler(({ url }) => {
    const decision = resolveExternalLink(url)
    if (decision.allowed) {
      void shell.openExternal(decision.url).catch((error) => {
        Logger.error('[Security] Failed to open external popup URL:', error)
      })
    } else {
      Logger.warn('[Security] Blocked remote content popup')
    }
    return { action: 'deny' }
  })

  const isGoogleWebSessionPartition = partition === PROFILE_PARTITION

  // SECURITY: Prevent an embedded page from navigating to an auth domain.
  // For Google web session apps the URL is handed to the system browser so the
  // user can finish signing in there; the Chrome extension then syncs the
  // resulting cookies back into this partition.
  const guardAuthNavigation = (event: Electron.Event, url: string): void => {
    if (!isAuthNavigationDomain(url)) return
    event.preventDefault()
    if (!isGoogleWebSessionPartition) return
    const decision = resolveExternalLink(url)
    if (decision.allowed) {
      void shell.openExternal(decision.url).catch(() => {
        // Navigation is already prevented; a missing default browser is not fatal.
      })
    }
  }

  const guardMainFrameNavigation = (event: Electron.Event, url: string): void => {
    // Fail closed on any scheme that has no legitimate use in an embedded page,
    // before the auth hand-off gets a chance to hand it to the system browser.
    if (!isAllowedRemoteNavigationScheme(url)) {
      event.preventDefault()
      Logger.warn('[Security] Blocked remote content navigation scheme')
      return
    }
    guardAuthNavigation(event, url)
  }

  webContents.on('will-navigate', guardMainFrameNavigation)
  webContents.on('will-redirect', guardMainFrameNavigation)

  // SECURITY: Fail closed on TLS errors. Chromium would otherwise show an
  // interstitial the embedded surface cannot render, leaving the user with no
  // actionable signal that content was tampered with.
  webContents.on('certificate-error', (event, _url, _error, _certificate, callback) => {
    event.preventDefault()
    callback(false)
  })

  webContents.on('did-finish-load', () => {
    if (webContents.isDestroyed()) return
    void webContents.executeJavaScript(REMOTE_CONTENT_CLIPBOARD_PROTECTION_SCRIPT).catch(() => {
      // Injection failure is non-fatal — the next did-finish-load retries on
      // the new document.
    })
  })
}
