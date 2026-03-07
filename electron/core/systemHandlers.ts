import { promises as fs } from 'fs'
import path from 'path'
import { app, ipcMain, shell, webContents, session, clipboard } from 'electron'
import { APP_CONFIG } from '../app/constants'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from '../features/ai/aiManager'
import { getMainWindow } from '../app/windowManager'

const SAFE_CACHE_DIRS = ['Cache', 'Code Cache', 'GPUCache'] as const

function getPartitionCacheRoot(userDataPath: string, partition: string): string | null {
    const partitionKey = partition.startsWith('persist:') ? partition.slice('persist:'.length) : partition
    if (!partitionKey) return null

    return path.join(userDataPath, 'Partitions', partitionKey)
}

async function clearSafeCacheDirectories(userDataPath: string, partitions: Set<string>) {
    const roots = new Set<string>([userDataPath])

    for (const partition of partitions) {
        const partitionRoot = getPartitionCacheRoot(userDataPath, partition)
        if (partitionRoot) {
            roots.add(partitionRoot)
        }
    }

    await Promise.allSettled(
        Array.from(roots).flatMap((rootPath) =>
            SAFE_CACHE_DIRS.map((dirName) =>
                fs.rm(path.join(rootPath, dirName), { recursive: true, force: true })
            )
        )
    )
}

export function registerSystemHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG

    // App Quit - allows renderer (e.g. splash screen) to exit the app
    ipcMain.handle(IPC_CHANNELS.APP_QUIT, () => {
        app.quit()
    })

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
            // Validation: Only allow main window to trigger force paste
            const mainWindow = getMainWindow()
            if (!mainWindow || event.sender !== mainWindow.webContents) {
                console.warn('[IPC] FORCE_PASTE blocked: sender is not main window')
                return false
            }

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
            const userDataPath = app.getPath('userData')

            // Clear default session cache
            await session.defaultSession.clearCache()

            // Collect all unique partitions from AI_REGISTRY + INACTIVE_PLATFORMS
            const allPartitions = new Set<string>()

            // Constantly include the legacy APP_CONFIG.PARTITIONS.AI just in case
            if (APP_CONFIG.PARTITIONS.AI) allPartitions.add(APP_CONFIG.PARTITIONS.AI)

            Object.values(AI_REGISTRY).forEach(p => p.partition && allPartitions.add(p.partition))
            Object.values(INACTIVE_PLATFORMS).forEach(p => p.partition && allPartitions.add(p.partition))

            // Clear AI session cache for all configured platforms
            const clearPromises = Array.from(allPartitions).map(async (partition) => {
                const pSession = session.fromPartition(partition)
                await pSession.clearCache()
                await pSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] })
            })

            await Promise.all(clearPromises)
            await clearSafeCacheDirectories(userDataPath, allPartitions)

            return true
        } catch (error) {
            console.error('[IPC] Failed to clear cache:', error)
            return false
        }
    })

    ipcMain.handle(IPC_CHANNELS.COPY_TEXT, (event, text: string) => {
        try {
            if (typeof text !== 'string' || text.length === 0) return false
            clipboard.writeText(text)
            return true
        } catch (error) {
            console.error('[Clipboard] Text copy failed:', error)
            return false
        }
    })
}
