import type { CacheBreakdown, PartitionDetail } from '../cacheMonitor.js'

export interface CleanupResult {
  filesDeleted: number
  bytesFreed: number
  errors: number
  duration: number
}

export interface SmartRecommendation {
  action: string
  reason: string
  targetPartitions: string[]
  estimatedFreeBytes: number
}

export interface CacheInfo {
  breakdown: CacheBreakdown
  lastCleanup: number | null
  lastCleanupResult: CleanupResult | null
  isIdle: boolean
  // Akıllı önbellek alanları (geriye uyumlu – optional)
  smart?: {
    pressureLevel: 'normal' | 'moderate' | 'warning' | 'high' | 'critical'
    pressurePercentage: number
    recommendation: SmartRecommendation
    partitionDetails: PartitionDetail[]
    autoClean: {
      enabled: boolean
      lastAutoCleanAt: number | null
    }
  }
}
