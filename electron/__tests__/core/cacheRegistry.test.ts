/**
 * Tests for electron/core/cacheRegistry.ts
 *
 * Covers cache rule generation, partition activity tracking,
 * protected file/path detection, and symlink safety checks.
 * All electron and AI-registry dependencies are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Module-level mocks ---
const mockGetPath = vi.fn().mockReturnValue('/mock/user-data')

vi.mock('electron', () => ({
  app: {
    getPath: (...args: any[]) => mockGetPath(...args)
  }
}))

vi.mock('@electron/app/constants', () => ({
  APP_CONFIG: {
    PARTITIONS: {
      AI: 'persist:ai_session',
      PDF: 'persist:pdf_viewer'
    },
    CLEANUP: {
      SAFE_CACHE_DIRS: ['Cache', 'Code Cache', 'GPUCache'],
      TEMP_FILE_TTL_MS: 3600000,
      CACHE_FILE_TTL_MS: 604800000 // 7 days
    }
  }
}))

vi.mock('@electron/features/ai/aiManager', () => ({
  AI_REGISTRY: {
    gemini: { partition: 'persist:gemini' },
    chatgpt: { partition: 'persist:chatgpt' }
  },
  INACTIVE_PLATFORMS: {
    old_platform: { partition: 'persist:old_platform' }
  }
}))

// Import after mocks are set up
const {
  getCacheRules,
  getProtectedFiles,
  getProtectedDirs,
  isProtectedPath,
  isSymlinkSafe,
  markPartitionActive
} = await import('@electron/core/cacheRegistry')

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cacheRegistry', () => {
  describe('getCacheRules', () => {
    it('returns base rules for root cache dirs', () => {
      const rules = getCacheRules()
      // Should include Cache, Code Cache, GPUCache
      const baseRules = rules.filter((r) => !r.relativePath.includes('Partitions'))
      expect(baseRules.length).toBeGreaterThanOrEqual(3)
      expect(baseRules.some((r) => r.relativePath === 'Cache')).toBe(true)
      expect(baseRules.some((r) => r.relativePath === 'Code Cache')).toBe(true)
      expect(baseRules.some((r) => r.relativePath === 'GPUCache')).toBe(true)
    })

    it('returns partition rules for AI partitions', () => {
      const rules = getCacheRules()
      const partitionRules = rules.filter((r) => r.relativePath.includes('Partitions'))
      // Should have rules for ai_session, gemini, chatgpt, old_platform
      expect(partitionRules.length).toBeGreaterThanOrEqual(4 * 3) // 4 partitions × 3 dirs
    })

    it('assigns cache category to all rules', () => {
      const rules = getCacheRules()
      for (const rule of rules) {
        expect(rule.category).toBe('cache')
      }
    })

    it('all rules have cleanupOnIdle true, cleanupOnStartup false by default', () => {
      const rules = getCacheRules()
      for (const rule of rules) {
        expect(rule.cleanupOnIdle).toBe(true)
        expect(rule.cleanupOnStartup).toBe(false)
      }
    })

    it('rules have ttlMs set', () => {
      const rules = getCacheRules()
      for (const rule of rules) {
        expect(rule.ttlMs).toBeGreaterThan(0)
      }
    })
  })

  describe('protected files and dirs', () => {
    it('protects window-state.json', () => {
      expect(getProtectedFiles().has('window-state.json')).toBe(true)
    })

    it('protects pdf-allowlist.json', () => {
      expect(getProtectedFiles().has('pdf-allowlist.json')).toBe(true)
    })

    it('protects gemini-web-profile directory', () => {
      expect(getProtectedDirs().has('gemini-web-profile')).toBe(true)
    })
  })

  describe('isProtectedPath', () => {
    const userDataPath = '/mock/user-data'

    it('returns true for protected file names', () => {
      expect(isProtectedPath('/mock/user-data/window-state.json', userDataPath)).toBe(true)
      expect(isProtectedPath('/mock/user-data/pdf-allowlist.json', userDataPath)).toBe(true)
    })

    it('returns true for protected directories', () => {
      expect(isProtectedPath('/mock/user-data/gemini-web-profile/cookies.db', userDataPath)).toBe(
        true
      )
    })

    it('returns true for Partitions storage subdirectories', () => {
      // The storage subdirectory (parent of the actual file) must be a protected type
      expect(
        isProtectedPath(
          '/mock/user-data/Partitions/gemini/Local Storage/https_test.com',
          userDataPath
        )
      ).toBe(true)
      expect(
        isProtectedPath('/mock/user-data/Partitions/gemini/IndexedDB/https_test.com', userDataPath)
      ).toBe(true)
      expect(
        isProtectedPath(
          '/mock/user-data/Partitions/gemini/Session Storage/https_test.com',
          userDataPath
        )
      ).toBe(true)
    })

    it('returns false for regular cache files outside protected paths', () => {
      expect(isProtectedPath('/mock/user-data/Cache/some-file', userDataPath)).toBe(false)
    })

    it('returns true for paths outside userData', () => {
      expect(isProtectedPath('/etc/passwd', userDataPath)).toBe(true)
    })

    it('returns true when path is equal to userData', () => {
      expect(isProtectedPath('/mock/user-data', userDataPath)).toBe(true)
    })
  })

  describe('isSymlinkSafe', () => {
    it('returns true for paths inside userData', () => {
      mockGetPath.mockReturnValue('/mock/user-data')
      expect(isSymlinkSafe('/mock/user-data/Cache/file')).toBe(true)
    })

    it('returns false for paths outside userData', () => {
      mockGetPath.mockReturnValue('/mock/user-data')
      expect(isSymlinkSafe('/etc/passwd')).toBe(false)
    })
  })

  describe('markPartitionActive', () => {
    it('can mark and check partition activity', () => {
      // We can't directly check activity since getActivityCategory is not exported,
      // but we can verify markPartitionActive doesn't throw
      expect(() => markPartitionActive('test-partition')).not.toThrow()
      expect(() => markPartitionActive('')).not.toThrow()
    })
  })
})
