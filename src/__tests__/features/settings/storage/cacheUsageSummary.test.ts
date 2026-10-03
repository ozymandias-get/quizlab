import type { CacheInfoResponse } from '@shared-core/types'

import {
  MAX_TOTAL_CACHE_BYTES,
  resolveCachePressure,
  resolvePartitionCacheRows
} from '@features/settings/ui/storage/cacheUsageSummary'
import { describe, expect, it } from 'vitest'

const t = (key: string) => key

function makeCacheInfo(overrides: Partial<CacheInfoResponse> = {}): CacheInfoResponse {
  return {
    breakdown: {
      chromiumCache: 0,
      codeCache: 0,
      gpuCache: 0,
      partitionCaches: {},
      tempFiles: 0,
      total: 0
    },
    lastCleanup: null,
    lastCleanupResult: null,
    isIdle: false,
    ...overrides
  }
}

function makeSmart(
  overrides: Partial<NonNullable<CacheInfoResponse['smart']>> = {}
): NonNullable<CacheInfoResponse['smart']> {
  return {
    pressureLevel: 'normal',
    pressurePercentage: 0,
    recommendation: {
      action: 'none',
      reason: '',
      targetPartitions: [],
      estimatedFreeBytes: 0
    },
    partitionDetails: [],
    autoClean: { enabled: true, lastAutoCleanAt: null },
    ...overrides
  }
}

describe('resolvePartitionCacheRows', () => {
  it('returns nothing when there is no cache info', () => {
    expect(resolvePartitionCacheRows(undefined, t)).toEqual([])
  })

  it('tolerates a payload with no breakdown instead of throwing', () => {
    // The tab reads this straight off the IPC response. A partial payload used
    // to render an empty list; it must not take the whole settings tab down.
    expect(resolvePartitionCacheRows({} as CacheInfoResponse, t)).toEqual([])
    expect(
      resolvePartitionCacheRows({ breakdown: undefined } as unknown as CacheInfoResponse, t)
    ).toEqual([])
  })

  it('lists smart partitions largest first and keeps empty cold ones', () => {
    const rows = resolvePartitionCacheRows(
      makeCacheInfo({
        smart: makeSmart({
          partitionDetails: [
            { key: 'ai_chatgpt', size: 10, category: 'active', lastActive: 5, ttlMs: 0 },
            { key: 'ai_claude', size: 30, category: 'passive', lastActive: 7, ttlMs: 0 },
            { key: 'ai_empty_cold', size: 0, category: 'cold', lastActive: null, ttlMs: 0 },
            { key: 'ai_empty_active', size: 0, category: 'active', lastActive: 9, ttlMs: 0 }
          ]
        })
      }),
      t
    )

    expect(rows.map((row) => row.key)).toEqual(['ai_claude', 'ai_chatgpt', 'ai_empty_cold'])
    expect(rows[0]).toMatchObject({ size: 30, category: 'passive', lastActive: 7 })
    // Names come from the shared partition display-name rules.
    expect(rows[0]?.label).toBe('Claude')
  })

  it('falls back to the plain partition map when smart data is absent', () => {
    const rows = resolvePartitionCacheRows(
      makeCacheInfo({
        breakdown: {
          chromiumCache: 0,
          codeCache: 0,
          gpuCache: 0,
          partitionCaches: { 'persist:ai_chatgpt': 5, 'persist:ai_claude': 50 },
          tempFiles: 0,
          total: 55
        }
      }),
      t
    )

    expect(rows).toEqual([
      {
        key: 'persist:ai_claude',
        label: 'Claude',
        size: 50,
        category: undefined,
        lastActive: null
      },
      {
        key: 'persist:ai_chatgpt',
        label: 'Chatgpt',
        size: 5,
        category: undefined,
        lastActive: null
      }
    ])
  })

  it('falls back when the smart breakdown exists but carries no partitions', () => {
    const rows = resolvePartitionCacheRows(
      makeCacheInfo({
        breakdown: {
          chromiumCache: 0,
          codeCache: 0,
          gpuCache: 0,
          partitionCaches: { 'persist:ai_session': 3 },
          tempFiles: 0,
          total: 3
        },
        smart: makeSmart({ partitionDetails: [] })
      }),
      t
    )

    expect(rows.map((row) => row.key)).toEqual(['persist:ai_session'])
  })
})

describe('resolveCachePressure', () => {
  it('prefers the scheduler classification when it exists', () => {
    const pressure = resolveCachePressure(
      makeCacheInfo({
        breakdown: {
          chromiumCache: 0,
          codeCache: 0,
          gpuCache: 0,
          partitionCaches: {},
          tempFiles: 0,
          total: MAX_TOTAL_CACHE_BYTES + 1
        },
        smart: makeSmart({ pressureLevel: 'moderate', pressurePercentage: 12.5 })
      })
    )

    expect(pressure).toMatchObject({
      level: 'moderate',
      percentage: 12.5,
      // The scheduler says "moderate", so the hard byte budget is not violated.
      isOverLimit: true
    })
  })

  it('falls back to the byte budget when no classification exists', () => {
    const under = resolveCachePressure(
      makeCacheInfo({
        breakdown: {
          chromiumCache: 0,
          codeCache: 0,
          gpuCache: 0,
          partitionCaches: {},
          tempFiles: 0,
          total: MAX_TOTAL_CACHE_BYTES * 0.5
        }
      })
    )
    expect(under).toMatchObject({ level: 'normal', isOverLimit: false })
    expect(under.percentage).toBeCloseTo(50)
    expect(under.barColor).toBe('bg-emerald-500')

    const near = resolveCachePressure(
      makeCacheInfo({
        breakdown: {
          chromiumCache: 0,
          codeCache: 0,
          gpuCache: 0,
          partitionCaches: {},
          tempFiles: 0,
          total: MAX_TOTAL_CACHE_BYTES * 0.9
        }
      })
    )
    expect(near).toMatchObject({ level: 'warning', isOverLimit: false })
    expect(near.barColor).toBe('bg-amber-500')

    const over = resolveCachePressure(
      makeCacheInfo({
        breakdown: {
          chromiumCache: 0,
          codeCache: 0,
          gpuCache: 0,
          partitionCaches: {},
          tempFiles: 0,
          total: MAX_TOTAL_CACHE_BYTES * 1.2
        }
      })
    )
    expect(over).toMatchObject({ level: 'critical', isOverLimit: true })
    expect(over.barColor).toBe('bg-rose-500')
  })

  it('treats a missing cache info as an empty, healthy cache', () => {
    expect(resolveCachePressure(undefined)).toMatchObject({
      level: 'normal',
      percentage: 0,
      isOverLimit: false
    })
  })

  it('tolerates a payload with no breakdown instead of throwing', () => {
    // `cacheInfo?.breakdown` only guards the first hop, so this used to be a
    // TypeError that crashed the Storage tab rather than showing an empty meter.
    expect(resolveCachePressure({} as CacheInfoResponse)).toMatchObject({
      level: 'normal',
      percentage: 0,
      isOverLimit: false
    })
    expect(
      resolveCachePressure({ breakdown: undefined } as unknown as CacheInfoResponse)
    ).toMatchObject({ level: 'normal', isOverLimit: false })
  })
})
