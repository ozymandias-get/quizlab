import { promises as fs } from 'fs'
import path from 'path'
import { app, ipcMain, shell, webContents, session, clipboard } from 'electron'
import { APP_CONFIG } from '../app/constants'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from '../features/ai/aiManager'
import { getMainWindow } from '../app/windowManager'
import { requireTrustedIpcSender } from './ipcSecurity'

const SAFE_CACHE_DIRS = ['Cache', 'Code Cache', 'GPUCache'] as const
const MODEL_STORAGE_TYPES = [
  'cookies',
  'filesystem',
  'indexdb',
  'localstorage',
  'shadercache',
  'websql',
  'serviceworkers',
  'cachestorage'
] as const
let handlersRegistered = false

function isMainWindowGuestContents(contents: Electron.WebContents): boolean {
  const mainWindow = getMainWindow()
  if (!mainWindow || contents.isDestroyed()) return false

  const guestContents = contents as Electron.WebContents & {
    hostWebContents?: Electron.WebContents
  }

  return guestContents.hostWebContents === mainWindow.webContents
}

function getPartitionCacheRoot(userDataPath: string, partition: string): string | null {
  const partitionKey = partition.startsWith('persist:')
    ? partition.slice('persist:'.length)
    : partition
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

function normalizeClearablePartition(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const normalized = input.trim()
  if (!normalized || normalized.length > 128) return null
  if (normalized !== APP_CONFIG.PARTITIONS.AI && !/^persist:ai_[a-z0-9_-]+$/i.test(normalized)) {
    return null
  }
  return normalized
}

function getRegisteredAiPartition(id: unknown): string | null {
  if (typeof id !== 'string' || id.length === 0 || id.length > 128) return null
  const platform = AI_REGISTRY[id] || INACTIVE_PLATFORMS[id]
  return normalizeClearablePartition(platform?.partition)
}

function resolveAiModelPartition(input: { id?: unknown; partition?: unknown }): string | null {
  const registeredPartition = getRegisteredAiPartition(input.id)
  if (registeredPartition) return registeredPartition

  return normalizeClearablePartition(input.partition)
}

export function registerSystemHandlers() {
  if (handlersRegistered) return
  handlersRegistered = true

  const { IPC_CHANNELS } = APP_CONFIG

  ipcMain.handle(IPC_CHANNELS.APP_QUIT, (event) => {
    if (!requireTrustedIpcSender(event)) return
    app.quit()
  })

  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (event, url: string) => {
    if (!requireTrustedIpcSender(event)) return false
    if (!url || typeof url !== 'string') return false
    try {
      const parsedUrl = new URL(url)
      const allowedProtocols = ['http:', 'https:', 'mailto:']
      if (allowedProtocols.includes(parsedUrl.protocol)) {
        await shell.openExternal(parsedUrl.toString())
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
      if (!requireTrustedIpcSender(event)) {
        console.warn('[IPC] FORCE_PASTE blocked: sender is not main window')
        return false
      }

      if (!webContentsId) return false
      const contents = webContents.fromId(webContentsId)

      if (contents && isMainWindowGuestContents(contents)) {
        contents.paste()
        return true
      }
      return false
    } catch (error) {
      console.error('[IPC] Force paste failed:', error)
      return false
    }
  })

  ipcMain.handle(IPC_CHANNELS.CLEAR_CACHE, async (event) => {
    if (!requireTrustedIpcSender(event)) return false
    try {
      const userDataPath = app.getPath('userData')

      await session.defaultSession.clearCache()

      const allPartitions = new Set<string>()

      if (APP_CONFIG.PARTITIONS.AI) allPartitions.add(APP_CONFIG.PARTITIONS.AI)

      Object.values(AI_REGISTRY).forEach((p) => p.partition && allPartitions.add(p.partition))
      Object.values(INACTIVE_PLATFORMS).forEach(
        (p) => p.partition && allPartitions.add(p.partition)
      )

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

  ipcMain.handle(
    IPC_CHANNELS.CLEAR_AI_MODEL_DATA,
    async (event, input: { id?: unknown; partition?: unknown }) => {
      if (!requireTrustedIpcSender(event)) return false
      try {
        const partition = resolveAiModelPartition(input || {})
        if (!partition) return false

        const userDataPath = app.getPath('userData')
        const pSession = session.fromPartition(partition)

        await pSession.clearCache()
        await pSession.clearStorageData({ storages: [...MODEL_STORAGE_TYPES] })
        await clearSafeCacheDirectories(userDataPath, new Set([partition]))

        return true
      } catch (error) {
        console.error('[IPC] Failed to clear AI model data:', error)
        return false
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.COPY_TEXT, (event, text: string) => {
    if (!requireTrustedIpcSender(event)) return false
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
