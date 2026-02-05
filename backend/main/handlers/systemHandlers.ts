import { ipcMain, shell, webContents, session } from 'electron'
import { APP_CONFIG } from '../constants'

export function registerSystemHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG

    ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (event, url: string) => {
        if (!url || typeof url !== 'string') return false
        try {
            const parsedUrl = new URL(url)
            const allowedProtocols = ['http:', 'https:', 'mailto:']
            if (allowedProtocols.includes(parsedUrl.protocol)) {
                await shell.openExternal(url)
                return true
            }
            return false
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error(`[IPC] External link error:`, message)
            return false
        }
    })

    ipcMain.handle(IPC_CHANNELS.FORCE_PASTE, async (event, webContentsId: number) => {
        try {
            if (!webContentsId) return false
            const contents = webContents.fromId(webContentsId)

            if (contents && !contents.isDestroyed()) {
                contents.paste()
                return true
            }
            return false
        } catch (error) {
            console.error('[IPC] Force paste failed:', error)
            return false
        }
    })

    ipcMain.handle(IPC_CHANNELS.CLEAR_CACHE, async () => {
        try {
            // Clear default session cache
            await session.defaultSession.clearCache()

            // Clear AI session cache for all platforms
            const aiSession = session.fromPartition(APP_CONFIG.PARTITIONS.AI)
            await aiSession.clearCache()
            await aiSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] })

            return true
        } catch (error) {
            console.error('[IPC] Failed to clear cache:', error)
            return false
        }
    })
}
