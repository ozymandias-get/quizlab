import type { CacheInfoResponse } from '@shared-core/types'

import {
  MAX_TOTAL_CACHE_BYTES,
  groupPartitionCacheRows,
  resolveCachePressure,
  resolvePartitionCacheRows
} from '@features/settings/ui/storage/cacheUsageSummary'
import { describe, expect, it } from 'vitest'

const t = (key: string) => key

it('uses a 1 GiB cache budget', () => {
  expect(MAX_TOTAL_CACHE_BYTES).toBe(1024 * 1024 * 1024)
})

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

  it('lists used partitions and meaningful cold caches, hiding tiny unused remnants', () => {
    const rows = resolvePartitionCacheRows(
      makeCacheInfo({
        smart: makeSmart({
          partitionDetails: [
            { key: 'ai_chatgpt', size: 2000, category: 'active', lastActive: 5, ttlMs: 0 },
            { key: 'ai_claude', size: 3000, category: 'passive', lastActive: 7, ttlMs: 0 },
            { key: 'ai_empty_cold', size: 0, category: 'cold', lastActive: null, ttlMs: 0 },
            { key: 'ai_remnant', size: 144, category: 'cold', lastActive: null, ttlMs: 0 },
            { key: 'ai_empty_active', size: 0, category: 'active', lastActive: 9, ttlMs: 0 }
          ]
        })
      }),
      t
    )

    expect(rows.map((row) => row.key)).toEqual(['ai_claude', 'ai_chatgpt'])
    expect(rows[0]).toMatchObject({ size: 3000, category: 'passive', lastActive: 7 })
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
          partitionCaches: { 'persist:ai_chatgpt': 5000, 'persist:ai_claude': 50000 },
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
        size: 50000,
        category: undefined,
        lastActive: null
      },
      {
        key: 'persist:ai_chatgpt',
        label: 'Chatgpt',
        size: 5000,
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
          partitionCaches: { 'persist:ai_session': 3000 },
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

it('groups historic custom profiles without merging their clear targets', () => {
  const rows = [
    {
      key: 'ai_custom_example',
      label: 'Custom Platform',
      size: 5000,
      category: 'active' as const,
      lastActive: 5
    },
    {
      key: 'ai_custom_example_12345678-1234-1234-1234-123456789abc',
      label: 'Custom Platform · Other profile',
      size: 3000,
      category: 'cold' as const,
      lastActive: null
    },
    { key: 'ai_chatgpt', label: 'ChatGPT', size: 2000, category: 'cold' as const, lastActive: null }
  ]
  const groups = groupPartitionCacheRows(rows)
  expect(groups).toHaveLength(2)
  expect(groups[0]).toMatchObject({ label: 'Custom Platform', size: 8000 })
  expect(groups[0].rows.map((row) => row.key)).toEqual([
    'ai_custom_example',
    'ai_custom_example_12345678-1234-1234-1234-123456789abc'
  ])
})

describe('resolveCachePressure', () => {
  it('uses the displayed byte budget even when a stale scheduler classification disagrees', () => {
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
      level: 'critical',
      percentage: ((MAX_TOTAL_CACHE_BYTES + 1) / MAX_TOTAL_CACHE_BYTES) * 100,
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
    expect(near).toMatchObject({ level: 'high', isOverLimit: false })

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
