/**
 * Akıllı Önbellek Politikası
 *
 * Toplam ve partition bazlı baskı seviyelerini tanımlar,
 * hangi seviyede hangi temizliğin tetikleneceğini belirler
 * ve eviction önceliğini hesaplar.
 */

import { APP_CONFIG } from '../app/constants.js'

const { MAX_TOTAL_CACHE_BYTES, MAX_PARTITION_CACHE_BYTES } = APP_CONFIG.CLEANUP

export type PressureLevel = 'normal' | 'moderate' | 'warning' | 'high' | 'critical'

export interface CachePressure {
  level: PressureLevel
  percentage: number
  usedBytes: number
  limitBytes: number
  excessBytes: number
  shouldAutoClean: boolean
  urgency: number // 0..100
}

export interface PartitionHealth {
  key: string
  size: number
  percentage: number
  level: PressureLevel
  isOverLimit: boolean
}

export interface SmartCacheRecommendation {
  action: 'none' | 'clean_cold' | 'clean_passive' | 'clean_all_partitions' | 'deep_clean'
  reason: string
  estimatedFreeBytes: number
  targetPartitions: string[]
}

// Watermark eşikleri (toplam cache için)
const WATERMARKS = {
  moderate: 0.6, // 60% => 300MB
  warning: 0.8, // 80% => 400MB
  high: 0.9, // 90% => 450MB
  critical: 1.0 // 100% => 500MB
} as const

// Partition eşikleri
const PARTITION_WATERMARKS = {
  warning: 0.8, // 80MB
  high: 0.9, // 90MB
  critical: 1.0 // 100MB
} as const

export function getCachePressure(totalBytes: number): CachePressure {
  const limit = MAX_TOTAL_CACHE_BYTES
  const pct = limit > 0 ? totalBytes / limit : 0
  const excess = Math.max(0, totalBytes - limit)
  let level: PressureLevel = 'normal'
  let urgency = 0
  let shouldAutoClean = false

  if (pct >= WATERMARKS.critical) {
    level = 'critical'
    urgency = 100
    shouldAutoClean = true
  } else if (pct >= WATERMARKS.high) {
    level = 'high'
    urgency = 75
    shouldAutoClean = true
  } else if (pct >= WATERMARKS.warning) {
    level = 'warning'
    urgency = 50
    shouldAutoClean = true
  } else if (pct >= WATERMARKS.moderate) {
    level = 'moderate'
    urgency = 25
    shouldAutoClean = false
  } else {
    level = 'normal'
    urgency = 0
    shouldAutoClean = false
  }

  return {
    level,
    percentage: pct * 100,
    usedBytes: totalBytes,
    limitBytes: limit,
    excessBytes: excess,
    shouldAutoClean,
    urgency
  }
}

export function getPartitionPressure(partitionSize: number): PartitionHealth {
  const limit = MAX_PARTITION_CACHE_BYTES
  const pct = limit > 0 ? partitionSize / limit : 0
  let level: PressureLevel = 'normal'
  if (pct >= PARTITION_WATERMARKS.critical) level = 'critical'
  else if (pct >= PARTITION_WATERMARKS.high) level = 'high'
  else if (pct >= PARTITION_WATERMARKS.warning) level = 'warning'
  else if (pct >= 0.6) level = 'moderate'

  return {
    key: '',
    size: partitionSize,
    percentage: pct * 100,
    level,
    isOverLimit: partitionSize > limit
  }
}

/**
 * Eviction önceliği: soğuk > pasif > aktif, aynı kategori içinde büyük boyut önce
 * Düşük skor = daha önce silinecek
 */
export function evictionScore(activity: 'cold' | 'passive' | 'active', size: number): number {
  const activityWeight = activity === 'cold' ? 0 : activity === 'passive' ? 1 : 2
  // Normalize size to 0..1 based on partition limit
  const sizeNorm = Math.min(size / MAX_PARTITION_CACHE_BYTES, 1)
  // Cold large partitions get lowest score (highest priority)
  return activityWeight * 10 - sizeNorm
}

export function sortPartitionsByEvictionPriority(
  partitions: Array<{ key: string; size: number; activity: 'cold' | 'passive' | 'active' }>
): Array<{ key: string; size: number; activity: 'cold' | 'passive' | 'active' }> {
  return [...partitions].sort((a, b) => {
    const sa = evictionScore(a.activity, a.size)
    const sb = evictionScore(b.activity, b.size)
    if (sa !== sb) return sa - sb
    return b.size - a.size
  })
}

export function getRecommendation(
  pressure: CachePressure,
  partitions: Array<{ key: string; size: number; activity: 'cold' | 'passive' | 'active' }>
): SmartCacheRecommendation {
  if (pressure.level === 'critical') {
    // Tüm cold+passive hedef, gerekirse active de
    const coldPassive = partitions.filter((p) => p.activity !== 'active')
    const all = coldPassive.length > 0 ? coldPassive : partitions
    const estimated = all.reduce((s, p) => s + p.size, 0) * 0.7
    return {
      action: 'clean_all_partitions',
      reason: 'critical_pressure',
      estimatedFreeBytes: estimated,
      targetPartitions: all.map((p) => p.key)
    }
  }
  if (pressure.level === 'high') {
    const cold = partitions.filter((p) => p.activity === 'cold')
    const targets = cold.length > 0 ? cold : partitions.filter((p) => p.activity === 'passive')
    if (targets.length > 0) {
      return {
        action: 'clean_cold',
        reason: 'high_pressure_cold_first',
        estimatedFreeBytes: targets.reduce((s, p) => s + p.size, 0) * 0.6,
        targetPartitions: targets.map((p) => p.key)
      }
    }
    return {
      action: 'deep_clean',
      reason: 'high_pressure_no_cold',
      estimatedFreeBytes: pressure.excessBytes,
      targetPartitions: []
    }
  }
  if (pressure.level === 'warning') {
    const overLimit = partitions.filter((p) => p.size > MAX_PARTITION_CACHE_BYTES * 0.8)
    if (overLimit.length > 0) {
      return {
        action: 'clean_passive',
        reason: 'warning_over_partition_limit',
        estimatedFreeBytes: overLimit.reduce((s, p) => s + p.size, 0) * 0.5,
        targetPartitions: overLimit.map((p) => p.key)
      }
    }
    // No immediate clean but suggest idle cleanup
    return {
      action: 'none',
      reason: 'warning_monitor',
      estimatedFreeBytes: 0,
      targetPartitions: []
    }
  }
  if (pressure.level === 'moderate') {
    const coldLarge = partitions.filter((p) => p.activity === 'cold' && p.size > 50 * 1024 * 1024)
    if (coldLarge.length > 0) {
      return {
        action: 'clean_cold',
        reason: 'moderate_cold_large',
        estimatedFreeBytes: coldLarge.reduce((s, p) => s + p.size, 0) * 0.5,
        targetPartitions: coldLarge.map((p) => p.key)
      }
    }
  }
  return { action: 'none', reason: 'normal', estimatedFreeBytes: 0, targetPartitions: [] }
}

// Otomatik temizlik cooldown ve min interval
export const SMART_CACHE_CONFIG = {
  AUTO_CLEAN_ENABLED_DEFAULT: true,
  AUTO_CLEAN_COOLDOWN_MS: 10 * 60 * 1000, // 10 dk
  AUTO_CLEAN_MIN_INTERVAL_MS: 5 * 60 * 1000, // 5 dk
  WATERMARKS,
  PARTITION_WATERMARKS
} as const

export type AutoCleanConfig = {
  enabled: boolean
  lastAutoCleanAt: number | null
  cooldownMs: number
}

export function shouldTriggerAutoClean(
  pressure: CachePressure,
  config: AutoCleanConfig,
  now: number = Date.now()
): boolean {
  if (!config.enabled) return false
  if (!pressure.shouldAutoClean) return false
  if (config.lastAutoCleanAt !== null) {
    const elapsed = now - config.lastAutoCleanAt
    if (elapsed < config.cooldownMs) return false
  }
  return true
}
