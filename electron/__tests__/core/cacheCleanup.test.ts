import { promises as fs } from 'fs'
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
