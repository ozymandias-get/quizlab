import { promises as fs } from 'fs'
import path from 'path'

import { APP_CONFIG } from '../../app/constants'
import { collectExpiredFiles, getDirectorySize, measureCacheBreakdown } from '../cacheMonitor'
import { getCacheRules } from '../cacheRegistry'
import { Logger } from '../logger'
import {
  cleanupOrphanedTempFiles,
  deleteBatch,
  deleteDirectoryContents,
  formatBytes,
  safeDeleteFile
} from './helpers'
import type { CleanupResult } from './types'

const {
  MAX_TOTAL_CACHE_BYTES,
  MAX_PARTITION_CACHE_BYTES,
  CACHE_FILE_TTL_MS,
  BATCH_DELETE_SIZE,
  BATCH_DELETE_SIZE_HEAVY,
  SAFE_CACHE_DIRS
} = APP_CONFIG.CLEANUP

async function cleanupExpiredCacheFiles(
  userDataPath: string
): Promise<{ deleted: number; freed: number; errors: number }> {
  let totalDeleted = 0
  let totalFreed = 0
  let totalErrors = 0

  const rules = getCacheRules()
  for (const rule of rules) {
    if (!rule.ttlMs) continue

    const dirPath = path.join(userDataPath, rule.relativePath)
    try {
      const stat = await fs.lstat(dirPath)
      if (!stat.isDirectory()) continue
    } catch {
      continue
    }

    const expired = await collectExpiredFiles(dirPath, userDataPath, rule.ttlMs)
    if (expired.length === 0) continue

    const sorted = expired.sort((a, b) => a.mtimeMs - b.mtimeMs)
    const batchSize = sorted.length > 100 ? BATCH_DELETE_SIZE_HEAVY : BATCH_DELETE_SIZE

    for (let i = 0; i < sorted.length; i += batchSize) {
      const batch = sorted.slice(i, i + batchSize)
      const result = await deleteBatch(batch, userDataPath, batchSize)
      totalDeleted += result.deleted
      totalFreed += result.freed
      totalErrors += result.errors

      if (i + batchSize < sorted.length) {
        await new Promise((resolve) => setImmediate(resolve))
      }
    }
  }

  return { deleted: totalDeleted, freed: totalFreed, errors: totalErrors }
}

async function trimPartitionCache(
  partitionKey: string,
  targetBytes: number,
  userDataPath: string,
  batchSize: number
): Promise<{ deleted: number; freed: number; errors: number }> {
  let totalDeleted = 0
  let totalFreed = 0
  let totalErrors = 0
  let currentSize = 0

  for (const cacheDir of SAFE_CACHE_DIRS) {
    const dirPath = path.join(userDataPath, 'Partitions', partitionKey, cacheDir)
    const expired = await collectExpiredFiles(dirPath, userDataPath, 0)
    if (expired.length === 0) continue

    const sorted = expired.sort((a, b) => a.mtimeMs - b.mtimeMs)

    for (let i = 0; i < sorted.length; i += batchSize) {
      if (currentSize === 0) {
        const dirStat = await getDirectorySize(dirPath)
        currentSize = dirStat.totalBytes
      }

      if (currentSize <= targetBytes) break

      const batch = sorted.slice(i, i + batchSize)
      const batchBytes = batch.reduce((sum, f) => sum + f.size, 0)
      const result = await deleteBatch(batch, userDataPath, batchSize)
      totalDeleted += result.deleted
      totalFreed += result.freed
      totalErrors += result.errors
      currentSize -= batchBytes

      if (i + batchSize < sorted.length) {
        await new Promise((resolve) => setImmediate(resolve))
      }
    }
  }

  return { deleted: totalDeleted, freed: totalFreed, errors: totalErrors }
}

async function enforceSizeLimits(
  userDataPath: string
): Promise<{ deleted: number; freed: number; errors: number }> {
  let totalDeleted = 0
  let totalFreed = 0
  let totalErrors = 0

  const breakdown = await measureCacheBreakdown()

  if (breakdown.total <= MAX_TOTAL_CACHE_BYTES) {
    return { deleted: 0, freed: 0, errors: 0 }
  }

  const excessBytes = breakdown.total - MAX_TOTAL_CACHE_BYTES
  let bytesToFree = excessBytes
  const batchSize = BATCH_DELETE_SIZE_HEAVY

  const partitionEntries = Object.entries(breakdown.partitionCaches).sort(([, a], [, b]) => b - a)

  for (const [key, size] of partitionEntries) {
    if (bytesToFree <= 0) break
    if (size <= MAX_PARTITION_CACHE_BYTES) continue

    const targetBytes = Math.max(MAX_PARTITION_CACHE_BYTES, size - bytesToFree)
    const result = await trimPartitionCache(key, targetBytes, userDataPath, batchSize)
    totalDeleted += result.deleted
    totalFreed += result.freed
    totalErrors += result.errors
    bytesToFree -= result.freed
  }

  if (bytesToFree > 0) {
    for (const [key] of partitionEntries) {
      if (bytesToFree <= 0) break
      const result = await trimPartitionCache(key, 0, userDataPath, batchSize)
      totalDeleted += result.deleted
      totalFreed += result.freed
      totalErrors += result.errors
      bytesToFree -= result.freed
    }
  }

  if (bytesToFree > 0) {
    const rootDirs = SAFE_CACHE_DIRS.map((dir) => ({
      dir,
      size:
        dir === 'Cache'
          ? breakdown.chromiumCache
          : dir === 'Code Cache'
            ? breakdown.codeCache
            : breakdown.gpuCache
    })).sort((a, b) => a.size - b.size)

    for (const { dir } of rootDirs) {
      if (bytesToFree <= 0) break

      const dirPath = path.join(userDataPath, dir)
      const expired = await collectExpiredFiles(dirPath, userDataPath, CACHE_FILE_TTL_MS / 2)

      const sorted = expired.sort((a, b) => a.mtimeMs - b.mtimeMs)
      for (let i = 0; i < sorted.length && bytesToFree > 0; i += batchSize) {
        const batch = sorted.slice(i, i + batchSize)
        const batchBytes = batch.reduce((sum, f) => sum + f.size, 0)
        const result = await deleteBatch(batch, userDataPath, batchSize)
        totalDeleted += result.deleted
        totalFreed += result.freed
        totalErrors += result.errors
        bytesToFree -= batchBytes

        if (i + batchSize < sorted.length) {
          await new Promise((resolve) => setImmediate(resolve))
        }
      }
    }
  }

  return { deleted: totalDeleted, freed: totalFreed, errors: totalErrors }
}

export { cleanupExpiredCacheFiles, enforceSizeLimits }
