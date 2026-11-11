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
import { MAX_TOTAL_CACHE_BYTES } from '@shared-core/constants/cacheLimits'
import type { CacheInfoResponse } from '@shared-core/types'

import { partitionDisplayName, pressureColor } from './storageUtils'

export { MAX_TOTAL_CACHE_BYTES }

type SmartCacheInfo = NonNullable<CacheInfoResponse['smart']>

export type CachePressureLevel = SmartCacheInfo['pressureLevel']

export interface PartitionCacheRow {
  key: string
  label: string
  size: number
  category: 'active' | 'passive' | 'cold' | undefined
  lastActive: number | null
}

interface PartitionCacheGroup {
  key: string
  label: string
  rows: PartitionCacheRow[]
  size: number
}

/** Groups disk partitions by service, not by an inferred account identity. */
export function groupPartitionCacheRows(
  rows: PartitionCacheRow[],
  t?: (key: string) => string
): PartitionCacheGroup[] {
  const groups = new Map<string, PartitionCacheGroup>()
  for (const row of rows) {
    const key = row.key
      .replace(/^persist:/, '')
      .replace(/_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '')
    const group = groups.get(key)
    if (group) {
      group.rows.push(row)
      group.size += row.size
    } else {
      groups.set(key, { key, label: partitionDisplayName(key, t), rows: [row], size: row.size })
    }
  }
  return [...groups.values()].sort((a, b) => b.size - a.size)
}

interface CachePressure {
  level: CachePressureLevel
  percentage: number
  isOverLimit: boolean
  barColor: string
}

/**
 * Hide tiny inactive cache remnants left by sessions that were never used.
 * They remain included in the total and are not deleted.
 */
export function resolvePartitionCacheRows(
  cacheInfo: CacheInfoResponse | undefined,
  t: (key: string) => string
): PartitionCacheRow[] {
  const details = cacheInfo?.smart?.partitionDetails
  if (details && details.length > 0) {
    return details
      .filter((detail) => detail.size > 1024)
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
    .filter(([, size]) => size > 1024)
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
  const ratio = total / MAX_TOTAL_CACHE_BYTES
  const level =
    ratio >= 1
      ? 'critical'
      : ratio >= 0.9
        ? 'high'
        : ratio >= 0.8
          ? 'warning'
          : ratio >= 0.6
            ? 'moderate'
            : 'normal'

  return {
    level,
    percentage: ratio * 100,
    isOverLimit,
    barColor: pressureColor(level)
  }
}
