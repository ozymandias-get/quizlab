import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

import { Logger } from './logger.js'

export interface DirectorySizeResult {
  totalBytes: number
  fileCount: number
}

export interface CacheBreakdown {
  chromiumCache: number
  codeCache: number
  gpuCache: number
  partitionCaches: Record<string, number>
  tempFiles: number
  total: number
}

export interface PartitionDetail {
  key: string
  size: number
  category: 'active' | 'passive' | 'cold'
  lastActive: number | null
  ttlMs: number
}

export interface SmartCacheBreakdown extends CacheBreakdown {
  pressureLevel: 'normal' | 'moderate' | 'warning' | 'high' | 'critical'
  pressurePercentage: number
  recommendation?: {
    action: string
    reason: string
    targetPartitions: string[]
    estimatedFreeBytes: number
  }
  partitionDetails: PartitionDetail[]
}

export interface CacheFileEntry {
  absolutePath: string
  relativePath: string
  size: number
  mtimeMs: number
}

/**
 * Telemetry for the last completed `measureCacheBreakdown()` walk.
 *
 * The walk is the single most expensive recurring filesystem job in the main
 * process: on the reference machine a 4.7k-file / 386 MB profile took ~405 ms
 * and issued ~6,000 sequential `fs` calls, each of which resumes as its own
 * event-loop turn while Chromium's browser-side IPC competes for the same loop.
 * Recording the cost lets a report correlate a user-visible stall with a scan
 * instead of guessing.
 */
export interface CacheScanTelemetry {
  durationMs: number
  filesVisited: number
  directoriesVisited: number
  at: number
}

let lastScanTelemetry: CacheScanTelemetry | null = null

export function getLastCacheScanTelemetry(): CacheScanTelemetry | null {
  return lastScanTelemetry
}

/**
 * Recursively totals a directory tree.
 *
 * Returns only the aggregate size and file count. A previous per-file
 * `entrySizes` map was carried up through every recursion level, but nothing in
 * production ever read it (only measureCacheBreakdown and trimPartitionCache
 * consume `.totalBytes`). On a 76.5k-file cache tree that dead map cost ~8% of
 * the walk and ~26% of its heap churn, and this walk runs on every cache
 * scheduler tick — so it was pure overhead on the hottest background path.
 */
export async function getDirectorySize(dirPath: string): Promise<DirectorySizeResult> {
  const result: DirectorySizeResult = { totalBytes: 0, fileCount: 0 }

  try {
    const stat = await fs.stat(dirPath)
    if (!stat.isDirectory()) {
      if (stat.isFile()) {
        result.totalBytes = stat.size
        result.fileCount = 1
      }
      return result
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      try {
        const entryStat = await fs.lstat(fullPath)
        if (entryStat.isSymbolicLink()) continue

        if (entryStat.isDirectory()) {
          const sub = await getDirectorySize(fullPath)
          result.totalBytes += sub.totalBytes
          result.fileCount += sub.fileCount
        } else if (entryStat.isFile()) {
          result.totalBytes += entryStat.size
          result.fileCount++
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  } catch {
    // Directory doesn't exist or not accessible
  }

  return result
}

async function collectCacheFiles(dirPath: string, userDataPath: string): Promise<CacheFileEntry[]> {
  const entries: CacheFileEntry[] = []

  try {
    const stat = await fs.stat(dirPath)
    if (!stat.isDirectory()) return entries

    const dirEntries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of dirEntries) {
      const fullPath = path.join(dirPath, entry.name)
      try {
        const entryStat = await fs.lstat(fullPath)
        if (entryStat.isSymbolicLink()) continue

        if (entryStat.isDirectory()) {
          const subEntries = await collectCacheFiles(fullPath, userDataPath)
          // Not push(...subEntries): a variadic spread of a large cache
          // directory can exceed the argument limit and throws RangeError,
          // which the catch below would turn into a silently truncated result.
          for (const subEntry of subEntries) {
            entries.push(subEntry)
          }
        } else if (entryStat.isFile()) {
          entries.push({
            absolutePath: fullPath,
            relativePath: path.relative(userDataPath, fullPath),
            size: entryStat.size,
            mtimeMs: entryStat.mtimeMs
          })
        }
      } catch {
        // Skip
      }
    }
  } catch {
    // Not accessible
  }

  return entries
}

export async function measureCacheBreakdown(): Promise<CacheBreakdown> {
  const startedAt = Date.now()
  const userDataPath = app.getPath('userData')
  Logger.debug('[CacheMonitor] scan start')

  const [rootCache, rootCodeCache, rootGpuCache] = await Promise.all([
    getDirectorySize(path.join(userDataPath, 'Cache')),
    getDirectorySize(path.join(userDataPath, 'Code Cache')),
    getDirectorySize(path.join(userDataPath, 'GPUCache'))
  ])

  const partitionCaches: Record<string, number> = {}
  let tempFiles = 0
  let filesVisited = rootCache.fileCount + rootCodeCache.fileCount + rootGpuCache.fileCount

  try {
    const partitionsDir = path.join(userDataPath, 'Partitions')
    const partitionEntries = await fs.readdir(partitionsDir, { withFileTypes: true })
    for (const entry of partitionEntries) {
      if (!entry.isDirectory()) continue
      const partitionPath = path.join(partitionsDir, entry.name)
      let partitionTotal = 0
      for (const cacheDir of ['Cache', 'Code Cache', 'GPUCache']) {
        const dirSize = await getDirectorySize(path.join(partitionPath, cacheDir))
        partitionTotal += dirSize.totalBytes
        filesVisited += dirSize.fileCount
      }
      partitionCaches[entry.name] = partitionTotal
    }
  } catch {
    // Partitions dir not accessible
  }

  try {
    const userDataEntries = await fs.readdir(userDataPath, { withFileTypes: true })
    for (const entry of userDataEntries) {
      if (!entry.isFile()) continue
      if (entry.name.endsWith('.tmp')) {
        const tmpPath = path.join(userDataPath, entry.name)
        try {
          const stat = await fs.lstat(tmpPath)
          if (!stat.isSymbolicLink()) {
            tempFiles += stat.size
          }
        } catch {
          // Skip
        }
      }
    }
  } catch {
    // Not accessible
  }

  const total =
    rootCache.totalBytes +
    rootCodeCache.totalBytes +
    rootGpuCache.totalBytes +
    Object.values(partitionCaches).reduce((a, b) => a + b, 0) +
    tempFiles

  const durationMs = Date.now() - startedAt
  lastScanTelemetry = {
    durationMs,
    filesVisited,
    directoriesVisited: Object.keys(partitionCaches).length + 3,
    at: Date.now()
  }
  Logger.debug(
    `[CacheMonitor] scan finish duration=${durationMs}ms files=${filesVisited} ` +
      `partitions=${Object.keys(partitionCaches).length} total=${(total / 1048576).toFixed(1)}MB`
  )

  return {
    chromiumCache: rootCache.totalBytes,
    codeCache: rootCodeCache.totalBytes,
    gpuCache: rootGpuCache.totalBytes,
    partitionCaches,
    tempFiles,
    total
  }
}

export async function collectExpiredFiles(
  dirPath: string,
  userDataPath: string,
  maxAgeMs: number
): Promise<CacheFileEntry[]> {
  const now = Date.now()
  const allFiles = await collectCacheFiles(dirPath, userDataPath)
  return allFiles.filter((f) => now - f.mtimeMs > maxAgeMs)
}

export async function measureSmartCacheBreakdown(): Promise<SmartCacheBreakdown> {
  const breakdown = await measureCacheBreakdown()

  // Lazy import to avoid circular deps - cacheRegistry depends on constants only
  const {
    getAllPartitionActivities,
    getActivityCategory,
    getEffectiveTtl,
    getPartitionLastActive
  } = await import('./cacheRegistry.js')
  const { getCachePressure, getRecommendation } = await import('./smartCachePolicy.js')

  const pressure = getCachePressure(breakdown.total)
  const activities = getAllPartitionActivities()

  // Partition details: birleştir diskteki ve activity'si olan tüm key'ler
  const allKeys = new Set<string>([
    ...Object.keys(breakdown.partitionCaches),
    ...Object.keys(activities)
  ])

  const partitionDetails: PartitionDetail[] = [...allKeys].map((key) => {
    const size = breakdown.partitionCaches[key] ?? 0
    const category = getActivityCategory(key)
    return {
      key,
      size,
      category,
      lastActive: getPartitionLastActive(key),
      ttlMs: getEffectiveTtl(key)
    }
  })

  // Sadece gerçekte diski olan veya aktivitesi bilinen ve boyutu >0 veya cold olanları filtrele
  // Ama UI'da tüm partition'lar gözüksün diye hepsini döndür, sıralama boyut + kategori
  partitionDetails.sort((a, b) => {
    const order = { cold: 0, passive: 1, active: 2 } as const
    if (order[a.category] !== order[b.category]) return order[a.category] - order[b.category]
    return b.size - a.size
  })

  const recommendation = getRecommendation(
    pressure,
    partitionDetails.map((p) => ({ key: p.key, size: p.size, activity: p.category }))
  )

  return {
    ...breakdown,
    pressureLevel: pressure.level,
    pressurePercentage: pressure.percentage,
    recommendation: {
      action: recommendation.action,
      reason: recommendation.reason,
      targetPartitions: recommendation.targetPartitions,
      estimatedFreeBytes: recommendation.estimatedFreeBytes
    },
    partitionDetails
  }
}
