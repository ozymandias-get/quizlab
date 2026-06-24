import { beforeEach, describe, expect, it, vi } from 'vitest'

import { formatBytes } from '../../../core/cacheCleanup/cacheCleanupHelpers.js'

describe('formatBytes', () => {
  it('formats bytes as B', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('formats kilobytes as KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 * 100)).toBe('100.0 KB')
  })

  it('formats megabytes as MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB')
    expect(formatBytes(1024 * 1024 * 100)).toBe('100.0 MB')
  })
})

describe('safeDeleteFile', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns false for paths outside userData', async () => {
    const { safeDeleteFile } = await import('../../../core/cacheCleanup/cacheCleanupHelpers.js')
    const result = await safeDeleteFile('/etc/passwd', '/tmp/userdata')
    expect(result).toBe(false)
  })

  it('returns false for protected paths', async () => {
    const { safeDeleteFile } = await import('../../../core/cacheCleanup/cacheCleanupHelpers.js')
    const result = await safeDeleteFile('/tmp/userdata/Config', '/tmp/userdata')
    expect(result).toBe(false)
  })

  it('returns false for non-existent files', async () => {
    const { safeDeleteFile } = await import('../../../core/cacheCleanup/cacheCleanupHelpers.js')
    const result = await safeDeleteFile('/tmp/userdata/nonexistent.txt', '/tmp/userdata')
    expect(result).toBe(false)
  })
})

describe('deleteBatch', () => {
  it('returns zero results for empty batch', async () => {
    const { deleteBatch } = await import('../../../core/cacheCleanup/cacheCleanupHelpers.js')
    const result = await deleteBatch([], '/tmp/userdata')
    expect(result).toEqual({ deleted: 0, freed: 0, errors: 0 })
  })
})

describe('deleteDirectoryContents', () => {
  it('returns zero results for non-existent directory', async () => {
    const { deleteDirectoryContents } =
      await import('../../../core/cacheCleanup/cacheCleanupHelpers.js')
    const result = await deleteDirectoryContents('/tmp/userdata/nonexistent', '/tmp/userdata')
    expect(result).toEqual({ deleted: 0, freed: 0, errors: 0 })
  })
})

describe('cleanupOrphanedTempFiles', () => {
  it('returns zero results for non-existent userData path', async () => {
    const { cleanupOrphanedTempFiles } =
      await import('../../../core/cacheCleanup/cacheCleanupHelpers.js')
    const result = await cleanupOrphanedTempFiles('/tmp/userdata/nonexistent')
    expect(result).toEqual({ deleted: 0, freed: 0, errors: 0 })
  })
})
