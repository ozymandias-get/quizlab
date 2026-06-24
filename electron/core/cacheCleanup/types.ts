import type { CacheBreakdown } from '../cacheMonitor.js'

export interface CleanupResult {
  filesDeleted: number
  bytesFreed: number
  errors: number
  duration: number
}

export interface CacheInfo {
  breakdown: CacheBreakdown
  lastCleanup: number | null
  lastCleanupResult: CleanupResult | null
  isIdle: boolean
}
