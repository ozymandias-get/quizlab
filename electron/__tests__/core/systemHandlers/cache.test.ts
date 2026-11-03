import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

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

  it('resolveAiModelPartition accepts Google primary and secondary slot partitions', async () => {
    const { resolveAiModelPartition } = await import('../../../core/systemHandlers/cache.js')
    expect(resolveAiModelPartition({ partition: 'persist:gemini_web_profile' })).toBe(
      'persist:gemini_web_profile'
    )
    expect(resolveAiModelPartition({ partition: 'persist:gemini_web_profile_slot_2' })).toBe(
      'persist:gemini_web_profile_slot_2'
    )
  })

  it('does not clear root cache while clearing a single partition', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quizlab-cache-root-'))
    try {
      const rootCache = path.join(root, 'Cache')
      const partitionCache = path.join(root, 'Partitions', 'ai_chatgpt', 'Cache')
      await fs.mkdir(rootCache, { recursive: true })
      await fs.mkdir(partitionCache, { recursive: true })
      await fs.writeFile(path.join(rootCache, 'keep'), 'root')
      await fs.writeFile(path.join(partitionCache, 'remove'), 'cache')
      const { clearSafeCacheDirectories } = await import('../../../core/systemHandlers/cache.js')
      await clearSafeCacheDirectories(root, new Set(['persist:ai_chatgpt']), false)
      expect(await fs.readFile(path.join(rootCache, 'keep'), 'utf8')).toBe('root')
      await expect(fs.access(partitionCache)).rejects.toThrow()
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('retries a locked cache directory before giving up', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quizlab-cache-retry-'))
    const cacheDir = path.join(root, 'Cache')
    await fs.mkdir(cacheDir, { recursive: true })
    const originalRm = fs.rm.bind(fs)
    let attempts = 0
    const rmSpy = vi.spyOn(fs, 'rm').mockImplementation((async (target: any, options: any) => {
      if (path.basename(String(target)) === 'Cache') {
        attempts += 1
        if (attempts === 1) {
          throw Object.assign(new Error('directory is busy'), { code: 'EBUSY' })
        }
      }
      return (originalRm as any)(target, options)
    }) as any)
    try {
      const { clearSafeCacheDirectories } = await import('../../../core/systemHandlers/cache.js')
      await expect(clearSafeCacheDirectories(root, new Set(), true)).resolves.toBeUndefined()
      expect(attempts).toBeGreaterThanOrEqual(2)
      await expect(fs.access(cacheDir)).rejects.toThrow()
    } finally {
      rmSpy.mockRestore()
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('does not fail the whole cleanup when one directory stays locked', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quizlab-cache-locked-'))
    const cacheDir = path.join(root, 'Cache')
    const lockedDir = path.join(root, 'Code Cache')
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.mkdir(lockedDir, { recursive: true })
    const originalRm = fs.rm.bind(fs)
    const rmSpy = vi.spyOn(fs, 'rm').mockImplementation((async (target: any, options: any) => {
      if (path.basename(String(target)) === 'Code Cache') {
        throw Object.assign(new Error('access denied'), { code: 'EIO' })
      }
      return (originalRm as any)(target, options)
    }) as any)
    try {
      const { clearSafeCacheDirectories } = await import('../../../core/systemHandlers/cache.js')
      await expect(clearSafeCacheDirectories(root, new Set(), true)).resolves.toBeUndefined()
      await expect(fs.access(cacheDir)).rejects.toThrow()
      await expect(fs.access(lockedDir)).resolves.toBeUndefined()
    } finally {
      rmSpy.mockRestore()
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('finds persisted custom and secondary Google partitions for cache cleanup', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quizlab-cache-partitions-'))
    try {
      for (const name of ['ai_custom_example', 'gemini_web_profile_slot_3', 'pdf_viewer']) {
        await fs.mkdir(path.join(root, 'Partitions', name), { recursive: true })
      }
      const { getStoredPartitions } = await import('../../../core/systemHandlers/cache.js')
      const partitions = await getStoredPartitions(root)
      expect(partitions.has('persist:ai_custom_example')).toBe(true)
      expect(partitions.has('persist:gemini_web_profile_slot_3')).toBe(true)
      expect(partitions.has('persist:pdf_viewer')).toBe(false)
      expect(partitions.has('persist:ai_chatgpt')).toBe(false)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
