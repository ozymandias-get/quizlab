import { ipcMain, BrowserWindow, clipboard, nativeImage } from 'electron'
import { APP_CONFIG } from '../constants'

export function registerScreenshotHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG

    ipcMain.handle(IPC_CHANNELS.CAPTURE_SCREEN, async (event, rect?: Electron.Rectangle) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender)
            if (!win || win.isDestroyed()) return null
            const image = await win.webContents.capturePage(rect)
            return image.toDataURL()
        } catch (error) {
            console.error('[Screenshot] Capture failed:', error)
            return null
        }
    })

    ipcMain.handle(IPC_CHANNELS.COPY_IMAGE, (event, dataUrl: string) => {
        try {
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
