/**
 * `runQuickCheck` is called on every idle tick, so re-walking the whole cache
 * tree each time is what made startup and idle CPU spike. A caller that already
 * holds an authoritative total must be able to hand it over, and the limit must
 * still be enforced against it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock-userData'),
    on: vi.fn()
  },
  ipcMain: {
    handle: vi.fn()
  }
}))

vi.mock('../../../app/constants', () => ({
  APP_CONFIG: {
    PARTITIONS: { AI: 'persist:ai_session', PDF: 'persist:pdf_viewer' },
    CLEANUP: {
      STARTUP_DELAY_MS: 5000,
      IDLE_TIMEOUT_MS: 300000,
      MAX_TOTAL_CACHE_BYTES: 500 * 1024 * 1024,
      MAX_PARTITION_CACHE_BYTES: 100 * 1024 * 1024,
      TEMP_FILE_TTL_MS: 3600000,
      CACHE_FILE_TTL_MS: 604800000,
      BATCH_DELETE_SIZE: 10,
      SAFE_CACHE_DIRS: ['Cache', 'Code Cache', 'GPUCache'],
      PARTITION_STORAGE_TYPES: ['cookies', 'localstorage', 'indexdb']
    },
    IPC_CHANNELS: {
      CACHE_INFO: 'cache-info',
      DEEP_CLEAN_CACHE: 'deep-clean-cache',
      CLEAR_CACHE: 'clear-cache',
      CLEAR_AI_MODEL_DATA: 'clear-ai-model-data',
      APP_QUIT: 'app-quit'
    }
  }
}))

vi.mock('../../../core/logger', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const MAX_TOTAL_CACHE_BYTES = 500 * 1024 * 1024

describe('runQuickCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  function mockFs() {
    vi.doMock('fs', () => ({
      default: {
        promises: {
          stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
          readdir: vi.fn().mockRejectedValue(new Error('ENOENT')),
          lstat: vi.fn().mockRejectedValue(new Error('ENOENT')),
          unlink: vi.fn().mockResolvedValue(undefined),
          rm: vi.fn().mockResolvedValue(undefined)
        }
      },
      promises: {
        stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
        readdir: vi.fn().mockRejectedValue(new Error('ENOENT')),
        lstat: vi.fn().mockRejectedValue(new Error('ENOENT')),
        unlink: vi.fn().mockResolvedValue(undefined),
        rm: vi.fn().mockResolvedValue(undefined)
      }
    }))
  }

  function mockMonitor(measureCacheBreakdown: ReturnType<typeof vi.fn>) {
    vi.doMock('../../../core/cacheMonitor.js', () => ({
      measureCacheBreakdown,
      measureSmartCacheBreakdown: vi.fn(),
      collectExpiredFiles: vi.fn()
    }))
  }

  it('does not re-walk the tree when the caller supplies the total', async () => {
    const measureCacheBreakdown = vi.fn().mockResolvedValue({ total: 0 })
    mockMonitor(measureCacheBreakdown)

    const { runQuickCheck } = await import('../../../core/cacheCleanup/index.js')
    await runQuickCheck(0)

    expect(measureCacheBreakdown).not.toHaveBeenCalled()
  })

  it('still measures when no total is supplied', async () => {
    mockFs()
    const measureCacheBreakdown = vi.fn().mockResolvedValue({ total: 0 })
    mockMonitor(measureCacheBreakdown)

    const { runQuickCheck } = await import('../../../core/cacheCleanup/index.js')
    await runQuickCheck()

    expect(measureCacheBreakdown).toHaveBeenCalledTimes(1)
  })

  it('enforces the limit against a supplied total that exceeds it', async () => {
    mockFs()
    const measureCacheBreakdown = vi.fn().mockResolvedValue({ total: 0 })
    mockMonitor(measureCacheBreakdown)
    const enforceSizeLimits = vi.fn().mockResolvedValue({ deleted: 3, freed: 30, errors: 0 })
    vi.doMock('../../../core/cacheCleanup/operations.js', () => ({
      enforceSizeLimits,
      cleanupExpiredCacheFiles: vi.fn()
    }))
    vi.doMock('../../../core/cacheCleanup/cacheCleanupHelpers.js', () => ({
      cleanupOrphanedTempFiles: vi.fn().mockResolvedValue({ deleted: 0, freed: 0, errors: 0 }),
      formatBytes: String
    }))

    const { runQuickCheck } = await import('../../../core/cacheCleanup/index.js')
    const result = await runQuickCheck(MAX_TOTAL_CACHE_BYTES + 1)

    expect(measureCacheBreakdown).not.toHaveBeenCalled()
    expect(enforceSizeLimits).toHaveBeenCalledTimes(1)
    expect(result.filesDeleted).toBe(3)
    expect(result.bytesFreed).toBe(30)
  })
})
