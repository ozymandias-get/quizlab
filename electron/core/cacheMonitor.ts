import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

export interface DirectorySizeResult {
  totalBytes: number
  fileCount: number
  entrySizes: Map<string, number>
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

export async function getDirectorySize(dirPath: string): Promise<DirectorySizeResult> {
  const result: DirectorySizeResult = { totalBytes: 0, fileCount: 0, entrySizes: new Map() }

  try {
    const stat = await fs.stat(dirPath)
    if (!stat.isDirectory()) {
      if (stat.isFile()) {
        result.totalBytes = stat.size
        result.fileCount = 1
        result.entrySizes.set(dirPath, stat.size)
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
          for (const [k, v] of sub.entrySizes) {
            result.entrySizes.set(k, v)
          }
        } else if (entryStat.isFile()) {
          result.totalBytes += entryStat.size
          result.fileCount++
          result.entrySizes.set(fullPath, entryStat.size)
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
          entries.push(...subEntries)
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
  const userDataPath = app.getPath('userData')

  const [rootCache, rootCodeCache, rootGpuCache] = await Promise.all([
    getDirectorySize(path.join(userDataPath, 'Cache')),
    getDirectorySize(path.join(userDataPath, 'Code Cache')),
    getDirectorySize(path.join(userDataPath, 'GPUCache'))
  ])

  const partitionCaches: Record<string, number> = {}
  let tempFiles = 0

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

export interface DoclingBreakdown {
  uvCache: number
  tempConversions: number
  runtime: number
  staleRuntime: number
  total: number
  activeRuntime: string | null
  staleRuntimes: string[]
  uvCacheExists: boolean
}

export async function measureDoclingBreakdown(): Promise<DoclingBreakdown> {
  const userDataPath = app.getPath('userData')
  const doclingBase = path.join(userDataPath, 'components', 'docling')
  const uvCachePath = path.join(doclingBase, 'temp', 'uv-cache')
  const tempPath = path.join(doclingBase, 'temp')
  const runtimePath = path.join(doclingBase, 'runtime')

  const [uvCache, tempAll, runtimeAll] = await Promise.all([
    getDirectorySize(uvCachePath),
    getDirectorySize(tempPath),
    getDirectorySize(runtimePath)
  ])

  let activeRuntime: string | null = null
  let staleRuntimes: string[] = []
  let staleRuntimeBytes = 0

  try {
    const pyvenv = path.join(doclingBase, 'environment', 'pyvenv.cfg')
    const cfg = await fs.readFile(pyvenv, 'utf-8')
    const homeMatch = cfg.match(/home\s*=\s*(.+)/)
    if (homeMatch) {
      const home = homeMatch[1].trim()
      activeRuntime = path.basename(home)
    }
  } catch {
    // No pyvenv.cfg yet
  }

  try {
    const runtimeEntries = await fs.readdir(runtimePath, { withFileTypes: true })
    for (const entry of runtimeEntries) {
      if (!entry.isDirectory()) continue
      if (entry.name === '.temp') continue
      if (activeRuntime && entry.name === activeRuntime) continue
      const full = path.join(runtimePath, entry.name)
      const sz = await getDirectorySize(full)
      if (sz.totalBytes > 0) {
        staleRuntimes.push(entry.name)
        staleRuntimeBytes += sz.totalBytes
      }
    }
  } catch {
    // No runtime dir
  }

  const tempConversions = Math.max(0, tempAll.totalBytes - uvCache.totalBytes)

  return {
    uvCache: uvCache.totalBytes,
    tempConversions,
    runtime: runtimeAll.totalBytes,
    staleRuntime: staleRuntimeBytes,
    total: uvCache.totalBytes + staleRuntimeBytes + tempConversions,
    activeRuntime,
    staleRuntimes,
    uvCacheExists: uvCache.totalBytes > 0
  }
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
