import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetPath = vi.fn()
const mockFromPartition = vi.fn()
const mockClearCache = vi.fn()
const mockClearStorageData = vi.fn()

vi.mock('electron', () => ({
  app: {
    getPath: (...args: any[]) => mockGetPath(...args)
  },
  session: {
    fromPartition: (...args: any[]) => mockFromPartition(...args)
  }
}))

const mockGetMainWindow = vi.fn()
vi.mock('../../../app/windowManager.js', () => ({
  getMainWindow: (...args: any[]) => mockGetMainWindow(...args)
}))

vi.mock('../../../features/ai/aiManager.js', () => ({
  AI_REGISTRY: {},
  INACTIVE_PLATFORMS: {}
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

  it('getAllPartitions returns partitions from config', async () => {
    const { getAllPartitions } = await import('../../../core/systemHandlers/cache.js')
    const partitions = getAllPartitions()
    expect(partitions instanceof Set).toBe(true)
  })

  it('resolveAiModelPartition returns null for empty input', async () => {
    const { resolveAiModelPartition } = await import('../../../core/systemHandlers/cache.js')
    expect(resolveAiModelPartition({})).toBeNull()
  })

  it('isMainWindowGuestContents returns false when main window is null', async () => {
    mockGetMainWindow.mockReturnValue(null)
    const { isMainWindowGuestContents } = await import('../../../core/systemHandlers/cache.js')
    const result = isMainWindowGuestContents({ isDestroyed: () => false } as any)
    expect(result).toBe(false)
  })
})
