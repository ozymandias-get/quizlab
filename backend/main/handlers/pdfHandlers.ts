import { ipcMain, BrowserWindow, Menu, MenuItem } from 'electron'
import { APP_CONFIG } from '../constants'

export function registerPdfHandlers() {
    const { IPC_CHANNELS, SCREENSHOT_TYPES } = APP_CONFIG

    ipcMain.on(IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU, (event, labels: Partial<Record<string, string>> = {}) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win || win.isDestroyed()) return

        const menu = new Menu()
        menu.append(new MenuItem({
            label: labels.full_page_screenshot || 'Full Page Screenshot',
            accelerator: 'CmdOrCtrl+S',
            click: () => win.webContents.send(IPC_CHANNELS.TRIGGER_SCREENSHOT, SCREENSHOT_TYPES.FULL)
        }))
        menu.append(new MenuItem({
            label: labels.crop_screenshot || 'Crop Screenshot',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => win.webContents.send(IPC_CHANNELS.TRIGGER_SCREENSHOT, SCREENSHOT_TYPES.CROP)
        }))
        menu.append(new MenuItem({ type: 'separator' }))
        menu.append(new MenuItem({ label: labels.zoom_in || 'Zoom In', role: 'zoomIn' }))
        menu.append(new MenuItem({ label: labels.zoom_out || 'Zoom Out', role: 'zoomOut' }))
        menu.append(new MenuItem({ label: labels.reset_zoom || 'Reset Zoom', role: 'resetZoom' }))
        menu.append(new MenuItem({ type: 'separator' }))
        menu.append(new MenuItem({ label: labels.reload || 'Reload', role: 'reload' }))
        menu.popup({ window: win })
    })
}
