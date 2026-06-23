import type { IpcMainInvokeEvent, WebContents } from 'electron'

import { getMainWindow } from '../app/windowManager'
import { Logger } from './logger'

/**
 * Origins considered safe for IPC access from the main window.
 */
const TRUSTED_ORIGINS = [
  'file://', // Production build
  'http://localhost', // Vite dev server
  'http://127.0.0.1' // Vite dev server (IPv4 loopback)
]

/**
 * Returns true if the given URL is from a trusted local origin.
 * This prevents open-redirect / XSS scenarios where the main window
 * has been navigated to a malicious external site while the WebContents
 * identity check (`sender === mainWindow.webContents`) still passes.
 */
function isTrustedOrigin(url: string): boolean {
  return TRUSTED_ORIGINS.some((origin) => url.startsWith(origin))
}

function isTrustedMainWindowSender(sender: WebContents): boolean {
  const mainWindow = getMainWindow()
  if (!mainWindow) return false
  if (sender !== mainWindow.webContents) return false

  // SECURITY: Verify the current page URL is a trusted local origin.
  // Without this check, an open redirect or XSS that navigates the main
  // window to an attacker-controlled site (e.g. https://evil.com) would
  // still pass the WebContents identity check above, granting the attacker
  // full access to privileged IPC handlers.
  //
  // NOTE: Use guarded access for getURL() — it is always available on
  // real Electron WebContents but may be absent on mock objects in tests.
  const currentUrl = typeof sender.getURL === 'function' ? sender.getURL() : 'file://'
  if (!isTrustedOrigin(currentUrl)) {
    Logger.warn('[IPC] Blocked sender from untrusted origin', {
      url: currentUrl
    })
    return false
  }

  return true
}

/**
 * Validates that the IPC event originated from the trusted main window.
 *
 * Accepts both `IpcMainInvokeEvent` (from `ipcMain.handle`) and
 * `IpcMainEvent` (from `ipcMain.on`) because both share the
 * `sender: WebContents` property that this function actually needs.
 *
 * Previously the call-site in `pdfHandlers.ts` used `event as never`
 * to work around the narrower type — that bypass is no longer needed.
 */
export function requireTrustedIpcSender(event: {
  sender: WebContents
  senderFrame?: unknown
}): boolean {
  if (!isTrustedMainWindowSender(event.sender)) {
    Logger.warn('[IPC] Blocked untrusted sender', {
      senderId: event.sender.id
    })
    return false
  }

  // SECURITY: Verify the IPC was sent from the main frame, not a subframe
  // (<webview>, <iframe>, or embedded child frame).  A compromised <webview>
  // could otherwise send IPC messages that pass the WebContents check because
  // webview guest contents share the same host WebContents identity.
  //
  // NOTE: senderFrame is always available on IpcMainInvokeEvent but may
  // be absent on mock objects in tests.
  const mainWc = getMainWindow()?.webContents
  if (
    event.senderFrame &&
    mainWc &&
    !mainWc.isDestroyed() &&
    mainWc.mainFrame &&
    event.senderFrame !== mainWc.mainFrame
  ) {
    const frameUrl =
      typeof event.senderFrame === 'object' &&
      event.senderFrame !== null &&
      'url' in event.senderFrame
        ? (event.senderFrame as { url: string }).url
        : 'unknown'
    Logger.warn('[IPC] Blocked sender from subframe', {
      senderId: event.sender.id,
      frameUrl
    })
    return false
  }

  return true
}
