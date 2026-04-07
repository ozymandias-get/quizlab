import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { getMainWindow } from '../app/windowManager'

function isTrustedMainWindowSender(sender: WebContents): boolean {
  const mainWindow = getMainWindow()
  return Boolean(mainWindow && sender === mainWindow.webContents)
}

export function requireTrustedIpcSender(event: IpcMainInvokeEvent): boolean {
  if (isTrustedMainWindowSender(event.sender)) return true
  console.warn('[IPC] Blocked untrusted sender', {
    senderId: event.sender.id,
    channel: event.type
  })
  return false
}
