/**
 * Turns a cache-info response into the two things the Storage tab actually
 * renders: one row per AI partition, and one pressure verdict for the whole
 * cache.
 *
 * Pure so both can be checked without React: the partition list has a documented
 * fallback path (plain `partitionCaches` when the smart breakdown is missing)
 * and the pressure verdict has its own fallback (a byte budget, used when the
 * scheduler has not classified the cache yet).
 */
import type { CacheInfoResponse } from '@shared-core/types'

import { partitionDisplayName, pressureColor } from './storageUtils'

export const MAX_TOTAL_CACHE_BYTES = 500 * 1024 * 1024

type SmartCacheInfo = NonNullable<CacheInfoResponse['smart']>

export type CachePressureLevel = SmartCacheInfo['pressureLevel']

export interface PartitionCacheRow {
  key: string
  label: string
  size: number
  category: 'active' | 'passive' | 'cold' | undefined
  lastActive: number | null
}

export interface CachePressure {
  level: CachePressureLevel
  percentage: number
  isOverLimit: boolean
  barColor: string
}

/**
 * One row per partition, largest first. Cold partitions are kept even at zero
 * bytes so the user can still clear them; everything else is dropped when empty.
 */
export function resolvePartitionCacheRows(
  cacheInfo: CacheInfoResponse | undefined,
  t: (key: string) => string
): PartitionCacheRow[] {
  const details = cacheInfo?.smart?.partitionDetails
  if (details && details.length > 0) {
    return details
      .filter((detail) => detail.size > 0 || detail.category === 'cold')
      .sort((a, b) => b.size - a.size)
      .map((detail) => ({
        key: detail.key,
        label: partitionDisplayName(detail.key, t),
        size: detail.size,
        category: detail.category,
        lastActive: detail.lastActive
      }))
  }

  const caches = cacheInfo?.breakdown?.partitionCaches ?? {}
  return Object.entries(caches)
    .sort(([, a], [, b]) => b - a)
    .map(([key, size]) => ({
      key,
      label: partitionDisplayName(key, t),
      size,
      category: undefined,
      lastActive: null
    }))
}

/**
 * The scheduler's own classification when it exists; otherwise the byte budget
 * is compared directly, which keeps the meter honest before the first
 * classification lands.
 */
export function resolveCachePressure(cacheInfo: CacheInfoResponse | undefined): CachePressure {
  const total = cacheInfo?.breakdown?.total ?? 0
  const isOverLimit = total > MAX_TOTAL_CACHE_BYTES
  const level =
    cacheInfo?.smart?.pressureLevel ??
    (isOverLimit ? 'critical' : total / MAX_TOTAL_CACHE_BYTES > 0.8 ? 'warning' : 'normal')

  return {
    level,
    percentage: cacheInfo?.smart?.pressurePercentage ?? (total / MAX_TOTAL_CACHE_BYTES) * 100,
    isOverLimit,
    barColor: pressureColor(level)
  }
}
