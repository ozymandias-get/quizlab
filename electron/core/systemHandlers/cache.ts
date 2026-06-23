import { app, session } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

import { APP_CONFIG } from '../../app/constants'
import { getMainWindow } from '../../app/windowManager'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from '../../features/ai/aiManager'
import type { getCacheInfo } from '../cacheCleanup'
import { Logger } from '../logger'

const SAFE_CACHE_DIRS = APP_CONFIG.CLEANUP.SAFE_CACHE_DIRS
const MODEL_STORAGE_TYPES = [...APP_CONFIG.CLEANUP.PARTITION_STORAGE_TYPES] as const

const protectedPartitions = new Set<string>()

export { MODEL_STORAGE_TYPES, protectedPartitions }

let cachedCacheInfo: Awaited<ReturnType<typeof getCacheInfo>> | null = null
let cachedCacheInfoTime = 0
const CACHE_INFO_TTL_MS = 2000

export function invalidateCacheInfo(): void {
  cachedCacheInfo = null
}

export function getCachedCacheInfo(): Awaited<ReturnType<typeof getCacheInfo>> | null {
  const now = Date.now()
  if (cachedCacheInfo && now - cachedCacheInfoTime < CACHE_INFO_TTL_MS) {
    return cachedCacheInfo
  }
  return null
}

export function setCachedCacheInfo(
  info: Awaited<ReturnType<typeof getCacheInfo>>,
  time: number
): void {
  cachedCacheInfo = info
  cachedCacheInfoTime = time
}

export function isMainWindowGuestContents(contents: Electron.WebContents): boolean {
  const mainWindow = getMainWindow()
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindow.webContents.isDestroyed() ||
    contents.isDestroyed()
  ) {
    return false
  }

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

  const sanitized = partitionKey.replaceAll(/["*/:<>?\\|]/g, '_')

  return path.join(userDataPath, 'Partitions', sanitized)
}

async function fsRetry<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; baseDelayMs?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const baseDelayMs = options?.baseDelayMs ?? 200
  let lastError: Error | undefined
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const code = (err as NodeJS.ErrnoException)?.code
      if (code !== 'EBUSY' && code !== 'EACCES') throw lastError
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)))
      }
    }
  }
  throw lastError!
}

export async function clearSafeCacheDirectories(userDataPath: string, partitions: Set<string>) {
  const roots = new Set<string>([userDataPath])

  for (const partition of partitions) {
    const partitionRoot = getPartitionCacheRoot(userDataPath, partition)
    if (partitionRoot) {
      roots.add(partitionRoot)
    }
  }

  await Promise.allSettled(
    [...roots].flatMap((rootPath) =>
      SAFE_CACHE_DIRS.map((dirName) =>
        fsRetry(() => fs.rm(path.join(rootPath, dirName), { recursive: true, force: true }))
      )
    )
  )
}

function normalizeClearablePartition(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const normalized = input.trim()
  if (!normalized || normalized.length > 128) return null
  if (normalized !== APP_CONFIG.PARTITIONS.AI && !/^persist:ai_[\w-]+$/i.test(normalized)) {
    return null
  }
  return normalized
}

function getRegisteredAiPartition(id: unknown): string | null {
  if (typeof id !== 'string' || id.length === 0 || id.length > 128) return null
  const owns = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key)
  if (owns(AI_REGISTRY, id)) {
    return normalizeClearablePartition(AI_REGISTRY[id]?.partition)
  }
  if (owns(INACTIVE_PLATFORMS, id)) {
    return normalizeClearablePartition(INACTIVE_PLATFORMS[id]?.partition)
  }
  return null
}

export function resolveAiModelPartition(input: {
  id?: unknown
  partition?: unknown
}): string | null {
  const registeredPartition = getRegisteredAiPartition(input.id)
  if (registeredPartition) return registeredPartition

  return normalizeClearablePartition(input.partition)
}

export function getAllPartitions(): Set<string> {
  const partitions = new Set<string>()

  if (APP_CONFIG.PARTITIONS.AI) partitions.add(APP_CONFIG.PARTITIONS.AI)

  for (const p of Object.values(AI_REGISTRY)) p.partition && partitions.add(p.partition)
  for (const p of Object.values(INACTIVE_PLATFORMS)) p.partition && partitions.add(p.partition)

  return partitions
}
