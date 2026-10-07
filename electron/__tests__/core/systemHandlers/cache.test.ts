import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetPath = vi.fn()
const mockFromPartition = vi.fn()

vi.mock('electron', () => ({
  app: {
    getPath: (...args: any[]) => mockGetPath(...args)
  },
  session: {
    fromPartition: (...args: any[]) => mockFromPartition(...args)
  }
}))

vi.mock('../../../features/ai/aiManager.js', () => ({
  AI_REGISTRY: { chatgpt: { partition: 'persist:ai_chatgpt' } },
  INACTIVE_PLATFORMS: { legacy: { partition: 'persist:legacy' } }
}))

describe('systemHandlers/cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('invalidateCacheInfo clears cached info', async () => {
    const { invalidateCacheInfo, getCachedCacheInfo, setCachedCacheInfo } =
      await import('../../../core/systemHandlers/cache.js')
    setCachedCacheInfo({ breakdown: { total: 100 } } as any, Date.now())
    invalidateCacheInfo()
    expect(getCachedCacheInfo()).toBeNull()
  })

  it('getCachedCacheInfo returns null when no cache set', async () => {
    const { getCachedCacheInfo } = await import('../../../core/systemHandlers/cache.js')
    expect(getCachedCacheInfo()).toBeNull()
  })

  it('getCachedCacheInfo returns cached value within TTL', async () => {
    const { getCachedCacheInfo, setCachedCacheInfo } =
      await import('../../../core/systemHandlers/cache.js')
    const info = { breakdown: { total: 100 } } as any
    setCachedCacheInfo(info, Date.now())
    const result = getCachedCacheInfo()
    expect(result).toEqual(info)
  })

  it('getAllPartitions collects the registry and inactive-platform partitions', async () => {
    const { getAllPartitions } = await import('../../../core/systemHandlers/cache.js')
    // One live platform, one retired one: both must reach the cleanup set, and
    // the shared AI partition is always present.
    const partitions = getAllPartitions()
    expect(partitions.has('persist:ai_chatgpt')).toBe(true)
    expect(partitions.has('persist:legacy')).toBe(true)
    expect(partitions.has('persist:ai_session')).toBe(true)
    expect(partitions.size).toBe(3)
  })

  it('protects recently active partitions from cleanup', async () => {
    const { isProtectedPartition } = await import('../../../core/systemHandlers/cache.js')
    const { markPartitionActive } = await import('../../../core/cacheRegistry.js')

    markPartitionActive('ai_chatgpt')

    expect(isProtectedPartition('persist:ai_chatgpt')).toBe(true)
  })

  it('resolveAiModelPartition returns null for empty input', async () => {
    const { resolveAiModelPartition } = await import('../../../core/systemHandlers/cache.js')
    expect(resolveAiModelPartition({})).toBeNull()
  })
})
