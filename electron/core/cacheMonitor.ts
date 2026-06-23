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
