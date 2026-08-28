import { promises as fs } from 'fs'
import path from 'path'

import { APP_CONFIG } from '../../app/constants.js'
import type { CacheFileEntry } from '../cacheMonitor.js'
import { isProtectedPath, isSymlinkSafe } from '../cacheRegistry.js'

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

      for (const settledResult of results) {
        if (settledResult.status === 'fulfilled' && settledResult.value) {
          totalDeleted += settledResult.value.deleted
          totalFreed += settledResult.value.freed
          totalErrors += settledResult.value.errors
        } else if (settledResult.status === 'rejected') {
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

export async function cleanupDoclingUvCache(
  userDataPath: string,
  options: { force?: boolean; sizeThresholdBytes?: number } = {}
): Promise<{ deleted: number; freed: number; errors: number; reason: string }> {
  const { DOCLING } = APP_CONFIG
  const threshold = options.sizeThresholdBytes ?? DOCLING.UV_CACHE_SIZE_THRESHOLD_BYTES
  const doclingUvCache = path.join(userDataPath, 'components', 'docling', 'temp', 'uv-cache')
  const componentJsonPath = path.join(userDataPath, 'components', 'docling', 'component.json')

  try {
    const stat = await fs.lstat(doclingUvCache)
    if (!stat.isDirectory()) return { deleted: 0, freed: 0, errors: 0, reason: 'no-dir' }
  } catch {
    return { deleted: 0, freed: 0, errors: 0, reason: 'no-dir' }
  }

  // Check TTL for failed install first: preserve 7 days unless force
  if (!options.force) {
    try {
      const compRaw = await fs.readFile(componentJsonPath, 'utf-8')
      const comp = JSON.parse(compRaw)
      const isFailed = comp.status === 'error' || comp.status === 'failed'
      if (isFailed) {
        const stat = await fs.stat(doclingUvCache).catch(() => null)
        if (stat && Date.now() - stat.mtimeMs < DOCLING.UV_CACHE_TTL_MS) {
          return { deleted: 0, freed: 0, errors: 0, reason: 'failed-ttl' }
        }
      }
    } catch {
      // ignore
    }
  }

  // Never prune before install completed (unless failed TTL already handled)
  try {
    const compRaw = await fs.readFile(componentJsonPath, 'utf-8')
    const comp = JSON.parse(compRaw)
    if (comp.status !== 'ready' && comp.lastPhase !== 'completed' && !options.force) {
      // If it's a failed status we already handled TTL above, so this is truly not-ready
      if (comp.status !== 'error' && comp.status !== 'failed') {
        return { deleted: 0, freed: 0, errors: 0, reason: 'not-ready' }
      }
      // Failed but TTL expired — allow prune
    }
  } catch {
    // If component.json missing, treat as not-ready unless forced
    if (!options.force) return { deleted: 0, freed: 0, errors: 0, reason: 'no-component' }
  }

  // Size guard: only prune if over threshold unless forced
  if (!options.force) {
    try {
      let totalBytes = 0
      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const e of entries) {
          const full = path.join(dir, e.name)
          const st = await fs.lstat(full).catch(() => null)
          if (!st || st.isSymbolicLink()) continue
          if (st.isDirectory()) await walk(full)
          else totalBytes += st.size
        }
      }
      await walk(doclingUvCache)
      if (totalBytes < threshold) {
        return { deleted: 0, freed: 0, errors: 0, reason: `below-threshold:${totalBytes}` }
      }
    } catch {
      // proceed to prune on error
    }
  }

  const before = await getDirectorySizeForCleanup(doclingUvCache)
  const result = await deleteDirectoryContents(doclingUvCache, userDataPath)
  // Recreate empty dir for future installs
  try {
    await fs.mkdir(doclingUvCache, { recursive: true })
  } catch {
    // ignore
  }
  return { ...result, reason: `pruned:${before.totalBytes}` }
}

async function getDirectorySizeForCleanup(dirPath: string): Promise<{ totalBytes: number }> {
  let total = 0
  try {
    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        const full = path.join(dir, e.name)
        const st = await fs.lstat(full).catch(() => null)
        if (!st || st.isSymbolicLink()) continue
        if (st.isDirectory()) await walk(full)
        else total += st.size
      }
    }
    await walk(dirPath)
  } catch {
    // ignore
  }
  return { totalBytes: total }
}

export async function cleanupStaleDoclingRuntimes(
  userDataPath: string
): Promise<{ deleted: number; freed: number; errors: number; removed: string[] }> {
  const doclingBase = path.join(userDataPath, 'components', 'docling')
  const runtimePath = path.join(doclingBase, 'runtime')
  const pyvenvPath = path.join(doclingBase, 'environment', 'pyvenv.cfg')

  let activeRuntime: string | null = null
  try {
    const cfg = await fs.readFile(pyvenvPath, 'utf-8')
    const m = cfg.match(/home\s*=\s*(.+)/)
    if (m) activeRuntime = path.basename(m[1].trim())
  } catch {
    // No pyvenv yet — cannot determine active, abort
    return { deleted: 0, freed: 0, errors: 0, removed: [] }
  }

  if (!activeRuntime) return { deleted: 0, freed: 0, errors: 0, removed: [] }

  let totalDeleted = 0
  let totalFreed = 0
  let totalErrors = 0
  const removed: string[] = []

  try {
    const entries = await fs.readdir(runtimePath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === '.temp') continue
      if (entry.name === activeRuntime) continue
      const full = path.join(runtimePath, entry.name)
      // Atomic safety: validate new runtime exists and is not empty
      try {
        const activeFull = path.join(runtimePath, activeRuntime)
        const activeStat = await fs.stat(activeFull).catch(() => null)
        if (!activeStat || !activeStat.isDirectory()) continue
        const activeSz = await getDirectorySizeForCleanup(activeFull)
        if (activeSz.totalBytes < 10 * 1024 * 1024) continue // <10MB likely corrupted
      } catch {
        continue
      }
      const before = await getDirectorySizeForCleanup(full)
      try {
        await fs.rm(full, { recursive: true, force: true })
        totalDeleted++
        totalFreed += before.totalBytes
        removed.push(entry.name)
      } catch {
        totalErrors++
      }
    }
  } catch {
    // no runtime dir
  }

  return { deleted: totalDeleted, freed: totalFreed, errors: totalErrors, removed }
}

export async function cleanupDoclingTempConversions(
  userDataPath: string
): Promise<{ deleted: number; freed: number; errors: number }> {
  const convPath = path.join(userDataPath, 'components', 'docling', 'temp', 'conversions')
  try {
    const stat = await fs.lstat(convPath)
    if (!stat.isDirectory()) return { deleted: 0, freed: 0, errors: 0 }
  } catch {
    return { deleted: 0, freed: 0, errors: 0 }
  }
  // TTL: 7 gün, işlem sonrası zaten silinir ama abandoned kalırsa idle'da temizle
  const now = Date.now()
  const ttlMs = APP_CONFIG.DOCLING.UV_CACHE_TTL_MS
  let deleted = 0
  let freed = 0
  let errors = 0
  try {
    const entries = await fs.readdir(convPath, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(convPath, e.name)
      try {
        const st = await fs.lstat(full)
        if (st.isSymbolicLink()) continue
        if (now - st.mtimeMs > ttlMs) {
          const before = st.isDirectory()
            ? await getDirectorySizeForCleanup(full)
            : { totalBytes: st.size }
          await fs.rm(full, { recursive: true, force: true })
          deleted++
          freed += before.totalBytes
        }
      } catch {
        errors++
      }
    }
  } catch {
    // ignore
  }
  return { deleted, freed, errors }
}
