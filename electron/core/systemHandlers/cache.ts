import { promises as fs } from 'fs'
import path from 'path'

import { GOOGLE_AI_WEB_SESSION_PARTITION } from '../../../shared/constants/googleAiWebApps.js'
import { APP_CONFIG } from '../../app/constants.js'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from '../../features/ai/aiManager.js'
import type { getCacheInfo } from '../cacheCleanup/index.js'
import { getActivityCategory } from '../cacheRegistry.js'
import { Logger } from '../logger.js'
import { getPartitionDirectory, getPartitionDirectoryName } from '../partitionPaths.js'

const SAFE_CACHE_DIRS = APP_CONFIG.CLEANUP.SAFE_CACHE_DIRS
const MODEL_STORAGE_TYPES = [...APP_CONFIG.CLEANUP.PARTITION_STORAGE_TYPES] as const

const protectedPartitions = new Set<string>()

export { MODEL_STORAGE_TYPES }

export function isProtectedPartition(partition: string): boolean {
  const normalized = partition.replace(/^persist:/, '')
  return (
    protectedPartitions.has(partition) ||
    protectedPartitions.has(normalized) ||
    getActivityCategory(partition) === 'active'
  )
}

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

function getPartitionCacheRoot(userDataPath: string, partition: string): string | null {
  // A partition without a name addresses no folder at all.
  if (!getPartitionDirectoryName(partition)) return null

  return getPartitionDirectory(userDataPath, partition)
}

/** Windows keeps cache files mapped while Chromium is running, so a locked
 *  directory surfaces as EBUSY/EACCES/EPERM/ENOTEMPTY and may clear after the
 *  handle is released. A transient error is worth another attempt. */
const RETRYABLE_FS_CODES = new Set(['EBUSY', 'EACCES', 'EPERM', 'ENOTEMPTY', 'ETXTBSY'])

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
      if (!code || !RETRYABLE_FS_CODES.has(code)) throw lastError
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)))
      }
    }
  }
  throw lastError!
}

export async function clearSafeCacheDirectories(
  userDataPath: string,
  partitions: Set<string>,
  includeRoot = true
) {
  const roots = new Set<string>(includeRoot ? [userDataPath] : [])

  for (const partition of partitions) {
    const partitionRoot = getPartitionCacheRoot(userDataPath, partition)
    if (partitionRoot) {
      roots.add(partitionRoot)
    }
  }

  const targets = [...roots].flatMap((rootPath) =>
    SAFE_CACHE_DIRS.map((dirName) => path.join(rootPath, dirName))
  )
  const failed = (
    await Promise.all(
      targets.map(async (target) => {
        try {
          await fsRetry(() => fs.rm(target, { recursive: true, force: true }))
          return null
        } catch (error) {
          return { target, error }
        }
      })
    )
  ).filter((failure): failure is { target: string; error: unknown } => failure !== null)

  // Cache clearing is best-effort: a directory that is still mapped by the
  // running Chromium process is normal and must not turn the whole action into
  // a failure. Keep the remaining files and report which paths were skipped.
  if (failed.length > 0) {
    Logger.warn(
      `[Cache] ${failed.length} cache director${failed.length === 1 ? 'y' : 'ies'} could not be removed because they are still in use:`,
      failed.map((failure) => failure.target)
    )
  }
}

/** Cache-only requests address exactly the partition shown by the storage UI. */
export function resolveCacheOnlyPartition(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 128) return null
  return /^persist:[a-z0-9_-]+$/i.test(input) ? input : null
}

function normalizeClearablePartition(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const normalized = input.trim()
  if (!normalized || normalized.length > 128) return null
  if (
    normalized !== APP_CONFIG.PARTITIONS.AI &&
    normalized !== GOOGLE_AI_WEB_SESSION_PARTITION &&
    !/^persist:ai_[\w-]+$/i.test(normalized)
  ) {
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

/** Include persisted custom partitions that are not in the registry. */
export async function getStoredPartitions(userDataPath: string): Promise<Set<string>> {
  const partitions = new Set<string>()
  const registered = getAllPartitions()
  try {
    const entries = await fs.readdir(path.join(userDataPath, 'Partitions'), { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue
      const partition = `persist:${entry.name}`
      if (registered.has(partition) || /^persist:ai_[a-z0-9_-]+$/i.test(partition)) {
        partitions.add(partition)
      }
    }
  } catch {
    // Do not create registered but unused sessions if the folder is unavailable.
  }
  return partitions
}
