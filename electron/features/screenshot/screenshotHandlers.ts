import { ipcMain, BrowserWindow, clipboard, nativeImage } from 'electron'
import { APP_CONFIG } from '../../app/constants'
import { requireTrustedIpcSender } from '../../core/ipcSecurity'

const MAX_CAPTURE_DIMENSION = 16384

export function registerScreenshotHandlers() {
  const { IPC_CHANNELS } = APP_CONFIG

  ipcMain.handle(IPC_CHANNELS.CAPTURE_SCREEN, async (event, rect?: Electron.Rectangle) => {
    try {
      if (!requireTrustedIpcSender(event)) return null
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win || win.isDestroyed()) return null

      if (rect) {
        if (
          rect.width > MAX_CAPTURE_DIMENSION ||
          rect.height > MAX_CAPTURE_DIMENSION ||
          rect.width <= 0 ||
          rect.height <= 0
        ) {
          console.warn('[Screenshot] Capture rejected: dimensions exceed safe limits', {
            width: rect.width,
            height: rect.height
          })
          return null
        }
      }

      const image = await win.webContents.capturePage(rect)
      return image.toDataURL()
    } catch (error) {
      console.error('[Screenshot] Capture failed:', error)
      return null
    }
  })

  ipcMain.handle(IPC_CHANNELS.COPY_IMAGE, (event, dataUrl: string) => {
    try {
      if (!requireTrustedIpcSender(event)) return false
      if (!dataUrl?.startsWith('data:image/')) return false
      const image = nativeImage.createFromDataURL(dataUrl)
      if (image.isEmpty()) return false
      clipboard.writeImage(image)
      return true
    } catch (error) {
      console.error('[Clipboard] Copy failed:', error)
      return false
    }
  })
}
