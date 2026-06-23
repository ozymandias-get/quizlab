import { promises as fs } from 'fs'
import path from 'path'

import { APP_CONFIG } from '../../app/constants'
import type { CacheFileEntry } from '../cacheMonitor'
import { isProtectedPath, isSymlinkSafe } from '../cacheRegistry'

const { BATCH_DELETE_SIZE, TEMP_FILE_TTL_MS } = APP_CONFIG.CLEANUP
const DELETE_CONCURRENCY = 8

function isWithinUserData(targetPath: string, userDataPath: string): boolean {
  const resolved = path.resolve(targetPath)
  const normalized = path.normalize(resolved)
  const userNormalized = path.normalize(userDataPath)
  return normalized.startsWith(userNormalized + path.sep) || normalized === userNormalized
}

export async function safeDeleteFile(filePath: string, userDataPath: string): Promise<boolean> {
  try {
    if (!isWithinUserData(filePath, userDataPath)) return false
    if (isProtectedPath(filePath, userDataPath)) return false

    const stat = await fs.lstat(filePath)
    if (stat.isSymbolicLink()) {
      if (!isSymlinkSafe(filePath)) return false
      await fs.unlink(filePath)
      return true
    }

    await fs.rm(filePath, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

export async function deleteBatch(
  files: CacheFileEntry[],
  userDataPath: string,
  batchSize: number = BATCH_DELETE_SIZE
): Promise<{ deleted: number; freed: number; errors: number }> {
  let deleted = 0
  let freed = 0
  let errors = 0

  const batch = files.slice(0, batchSize)
  const results = await Promise.allSettled(
    batch.map(async (file) => {
      const success = await safeDeleteFile(file.absolutePath, userDataPath)
      if (success) {
        deleted++
        freed += file.size
      } else {
        errors++
      }
    })
  )

  errors += results.filter((r) => r.status === 'rejected').length
  return { deleted, freed, errors }
}

export async function deleteDirectoryContents(
  dirPath: string,
  userDataPath: string
): Promise<{ deleted: number; freed: number; errors: number }> {
  let totalDeleted = 0
  let totalFreed = 0
  let totalErrors = 0

  try {
    const stat = await fs.lstat(dirPath)
    if (stat.isSymbolicLink()) {
      if (isSymlinkSafe(dirPath) && isWithinUserData(dirPath, userDataPath)) {
        await fs.unlink(dirPath)
        return { deleted: 1, freed: 0, errors: 0 }
      }
      return { deleted: 0, freed: 0, errors: 0 }
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (let i = 0; i < entries.length; i += DELETE_CONCURRENCY) {
      const batch = entries.slice(i, i + DELETE_CONCURRENCY)
      const results = await Promise.allSettled(
        batch.map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name)
          if (!isWithinUserData(fullPath, userDataPath)) return null
          if (isProtectedPath(fullPath, userDataPath)) return null

          const entryStat = await fs.lstat(fullPath)
          if (entryStat.isSymbolicLink()) {
            if (isSymlinkSafe(fullPath)) {
              await fs.unlink(fullPath)
              return { deleted: 1, freed: 0, errors: 0 }
            }
            return { deleted: 0, freed: 0, errors: 1 }
          }
          if (entryStat.isDirectory()) {
            return deleteDirectoryContents(fullPath, userDataPath)
          }
          if (entryStat.isFile()) {
            const success = await safeDeleteFile(fullPath, userDataPath)
            if (success) {
              return { deleted: 1, freed: entryStat.size, errors: 0 }
            }
            return { deleted: 0, freed: 0, errors: 1 }
          }
          return null
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          totalDeleted += result.value.deleted
          totalFreed += result.value.freed
          totalErrors += result.value.errors
        } else if (result.status === 'rejected') {
          totalErrors++
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return { deleted: totalDeleted, freed: totalFreed, errors: totalErrors }
}

export async function cleanupOrphanedTempFiles(
  userDataPath: string
): Promise<{ deleted: number; freed: number; errors: number }> {
  let totalDeleted = 0
  let totalFreed = 0
  let totalErrors = 0
  const now = Date.now()

  try {
    const entries = await fs.readdir(userDataPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.tmp')) continue

      const tmpPath = path.join(userDataPath, entry.name)
      try {
        const stat = await fs.lstat(tmpPath)
        if (stat.isSymbolicLink()) continue

        if (now - stat.mtimeMs > TEMP_FILE_TTL_MS) {
          const success = await safeDeleteFile(tmpPath, userDataPath)
          if (success) {
            totalDeleted++
            totalFreed += stat.size
          } else {
            totalErrors++
          }
        }
      } catch {
        totalErrors++
      }
    }
  } catch {
    // Not accessible
  }

  return { deleted: totalDeleted, freed: totalFreed, errors: totalErrors }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
