import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const userDataPath = '/mock-userData'
const mockGetPath = vi.fn((name: string) => (name === 'userData' ? userDataPath : `/mock/${name}`))

vi.mock('electron', () => ({
  app: {
    getPath: mockGetPath,
    on: vi.fn()
  },
  ipcMain: {
    handle: vi.fn()
  }
}))

vi.mock('../../app/constants', () => ({
  APP_CONFIG: {
    PARTITIONS: {
      AI: 'persist:ai_session',
      PDF: 'persist:pdf_viewer'
    },
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

vi.mock('../../core/logger', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('cacheRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('getCacheRules returns rules for safe cache dirs', async () => {
    const { getCacheRules } = await import('../../core/cacheRegistry.js')
    const rules = getCacheRules()
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.some((r) => r.relativePath === 'Cache')).toBe(true)
    expect(rules.some((r) => r.relativePath === 'Code Cache')).toBe(true)
    expect(rules.some((r) => r.relativePath === 'GPUCache')).toBe(true)
  })

  it('getProtectedFiles returns known protected files', async () => {
    const { getProtectedFiles } = await import('../../core/cacheRegistry.js')
    const files = getProtectedFiles()
    expect(files.has('window-state.json')).toBe(true)
    expect(files.has('ai_custom_selectors.json')).toBe(true)
    expect(files.has('api_chat_config.json')).toBe(true)
    expect(files.has('gemini-web-session.json')).toBe(true)
  })

  it('getProtectedDirs returns known protected dirs', async () => {
    const { getProtectedDirs } = await import('../../core/cacheRegistry.js')
    const dirs = getProtectedDirs()
    expect(dirs.has('gemini-web-profile')).toBe(true)
  })

  it('isProtectedPath blocks known protected files', async () => {
    const { isProtectedPath } = await import('../../core/cacheRegistry.js')
    expect(isProtectedPath(path.join(userDataPath, 'window-state.json'), userDataPath)).toBe(true)
    expect(isProtectedPath(path.join(userDataPath, 'ai_custom_selectors.json'), userDataPath)).toBe(
      true
    )
    expect(isProtectedPath(path.join(userDataPath, 'api_chat_config.json'), userDataPath)).toBe(
      true
    )
  })

  it('isProtectedPath blocks protected directories', async () => {
    const { isProtectedPath } = await import('../../core/cacheRegistry.js')
    expect(
      isProtectedPath(path.join(userDataPath, 'gemini-web-profile', 'some-file'), userDataPath)
    ).toBe(true)
  })

  it('isProtectedPath allows cache dirs', async () => {
    const { isProtectedPath } = await import('../../core/cacheRegistry.js')
    expect(isProtectedPath(path.join(userDataPath, 'Cache', 'some-file'), userDataPath)).toBe(false)
    expect(isProtectedPath(path.join(userDataPath, 'Code Cache', 'some-file'), userDataPath)).toBe(
      false
    )
  })

  it('isProtectedPath blocks path traversal attempts', async () => {
    const { isProtectedPath } = await import('../../core/cacheRegistry.js')
    expect(isProtectedPath(path.join(userDataPath, '..', 'etc', 'passwd'), userDataPath)).toBe(true)
  })

  it('isProtectedPath blocks partition storage subdirs', async () => {
    const { isProtectedPath } = await import('../../core/cacheRegistry.js')
    expect(
      isProtectedPath(
        path.join(userDataPath, 'Partitions', 'ai_session', 'cookies', 'some-file'),
        userDataPath
      )
    ).toBe(true)
    expect(
      isProtectedPath(
        path.join(userDataPath, 'Partitions', 'ai_session', 'localstorage', 'some-file'),
        userDataPath
      )
    ).toBe(true)
  })

  it('isProtectedPath blocks absolute external paths', async () => {
    const { isProtectedPath } = await import('../../core/cacheRegistry.js')
    expect(isProtectedPath(path.resolve('/etc/passwd'), userDataPath)).toBe(true)
    expect(isProtectedPath(path.resolve('/tmp/something'), userDataPath)).toBe(true)
  })
})

describe('cacheMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('measureCacheBreakdown returns valid structure', async () => {
    vi.doMock('fs', () => ({
      default: {
        promises: {
          stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
          readdir: vi.fn().mockRejectedValue(new Error('ENOENT')),
          lstat: vi.fn().mockRejectedValue(new Error('ENOENT'))
        }
      },
      promises: {
        stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
        readdir: vi.fn().mockRejectedValue(new Error('ENOENT')),
        lstat: vi.fn().mockRejectedValue(new Error('ENOENT'))
      }
    }))

    const { measureCacheBreakdown } = await import('../../core/cacheMonitor.js')
    const result = await measureCacheBreakdown()

    expect(result).toHaveProperty('chromiumCache')
    expect(result).toHaveProperty('codeCache')
    expect(result).toHaveProperty('gpuCache')
    expect(result).toHaveProperty('partitionCaches')
    expect(result).toHaveProperty('tempFiles')
    expect(result).toHaveProperty('total')
    expect(typeof result.total).toBe('number')
  })
})

describe('runQuickCheck reuse of an already-measured total', () => {
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

  it('does not re-walk the tree when the caller supplies the total', async () => {
    const measureCacheBreakdown = vi.fn().mockResolvedValue({ total: 0 })
    vi.doMock('../../core/cacheMonitor.js', () => ({
      measureCacheBreakdown,
      measureSmartCacheBreakdown: vi.fn(),
      collectExpiredFiles: vi.fn()
    }))

    const { runQuickCheck } = await import('../../core/cacheCleanup/index.js')
    await runQuickCheck(0)

    expect(measureCacheBreakdown).not.toHaveBeenCalled()
  })

  it('still measures when no total is supplied', async () => {
    mockFs()
    const measureCacheBreakdown = vi.fn().mockResolvedValue({ total: 0 })
    vi.doMock('../../core/cacheMonitor.js', () => ({
      measureCacheBreakdown,
      measureSmartCacheBreakdown: vi.fn(),
      collectExpiredFiles: vi.fn()
    }))

    const { runQuickCheck } = await import('../../core/cacheCleanup/index.js')
    await runQuickCheck()

    expect(measureCacheBreakdown).toHaveBeenCalledTimes(1)
  })

  it('acts on a supplied total that exceeds the limit', async () => {
    mockFs()
    const measureCacheBreakdown = vi.fn().mockResolvedValue({ total: 0 })
    const enforceSizeLimits = vi.fn().mockResolvedValue({ deleted: 3, freed: 30, errors: 0 })
    vi.doMock('../../core/cacheMonitor.js', () => ({
      measureCacheBreakdown,
      measureSmartCacheBreakdown: vi.fn(),
      collectExpiredFiles: vi.fn()
    }))
    vi.doMock('../../core/cacheCleanup/operations.js', () => ({
      enforceSizeLimits,
      cleanupExpiredCacheFiles: vi.fn()
    }))
    vi.doMock('../../core/cacheCleanup/cacheCleanupHelpers.js', () => ({
      cleanupOrphanedTempFiles: vi.fn().mockResolvedValue({ deleted: 0, freed: 0, errors: 0 }),
      formatBytes: String
    }))

    const { runQuickCheck } = await import('../../core/cacheCleanup/index.js')
    const result = await runQuickCheck(501 * 1024 * 1024)

    expect(measureCacheBreakdown).not.toHaveBeenCalled()
    expect(enforceSizeLimits).toHaveBeenCalledTimes(1)
    expect(result.filesDeleted).toBe(3)
    expect(result.bytesFreed).toBe(30)
  })
})
