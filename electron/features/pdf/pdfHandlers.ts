import { BrowserWindow, ipcMain, Menu, MenuItem } from 'electron'

import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'

let handlersRegistered = false

export function registerPdfHandlers() {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS, SCREENSHOT_TYPES } = APP_CONFIG

  ipcMain.on(IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU, (event, rawLabels: unknown = {}) => {
    // SECURITY: Use centralized sender validation (logs untrusted attempts)
    // Note: ipcMain.on provides IpcMainEvent, ipcMain.handle provides
    // IpcMainInvokeEvent.  Both share the .sender property that
    // requireTrustedIpcSender needs — no type cast necessary.
    if (!requireTrustedIpcSender(event)) return

    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || win.isDestroyed()) return

    // A null/array/primitive payload must not reach `labels.x`: a default
    // parameter only covers `undefined`. Every label is a bounded string; a
    // non-string falls back to the English default.
    const labels =
      typeof rawLabels === 'object' && rawLabels !== null && !Array.isArray(rawLabels)
        ? (rawLabels as Record<string, unknown>)
        : {}
    const label = (key: string, fallback: string): string => {
      const value = labels[key]
      return typeof value === 'string' && value.trim() ? value : fallback
    }

    // Capture the sender's WebContents at context-menu creation time so
    // the click handlers below send signals to the CORRECT frame.
    // When a PDF is displayed inside a sub-frame of the main
    // window:
    //   - event.sender points to the sub-frame's WebContents (correct)
    //   - win.webContents points to the main frame (WRONG target)
    // Using the captured sender ensures zoom/screenshot signals reach
    // the PDF viewer frame, not the main app UI.
    const targetContents = event.sender
    const safeSend = (channel: string, ...args: unknown[]) => {
      if (typeof targetContents?.isDestroyed !== 'function' || !targetContents.isDestroyed()) {
        targetContents.send(channel, ...args)
      }
    }

    const menu = new Menu()
    menu.append(
      new MenuItem({
        label: label('full_page_screenshot', 'Full Page Screenshot'),
        // NOTE: Intentionally NOT using CmdOrCtrl+S — that accelerator
        // conflicts with the OS-level "Save File" shortcut (Cmd+S / Ctrl+S),
        // causing the app to take screenshots when the user intended to save.
        // Using CmdOrCtrl+Alt+S instead (non-standard, no OS conflict).
        accelerator: 'CmdOrCtrl+Alt+S',
        click: () => safeSend(IPC_CHANNELS.TRIGGER_SCREENSHOT, SCREENSHOT_TYPES.FULL)
      })
    )
    menu.append(
      new MenuItem({
        label: label('crop_screenshot', 'Crop Screenshot'),
        accelerator: 'CmdOrCtrl+Shift+S',
        click: () => safeSend(IPC_CHANNELS.TRIGGER_SCREENSHOT, SCREENSHOT_TYPES.CROP)
      })
    )
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(
      new MenuItem({
        label: label('zoom_in', 'Zoom In'),
        accelerator: 'CmdOrCtrl+Plus',
        click: () => safeSend(IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, 'in')
      })
    )
    menu.append(
      new MenuItem({
        label: label('zoom_out', 'Zoom Out'),
        accelerator: 'CmdOrCtrl+-',
        click: () => safeSend(IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, 'out')
      })
    )
    menu.append(
      new MenuItem({
        label: label('reset_zoom', 'Reset Zoom'),
        accelerator: 'CmdOrCtrl+0',
        click: () => safeSend(IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, 'reset')
      })
    )
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: label('reload', 'Reload'), role: 'reload' }))
    menu.popup({ window: win })
  })
}
