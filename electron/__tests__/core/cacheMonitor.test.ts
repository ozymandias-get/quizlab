/**
 * Tests for electron/core/cacheMonitor.ts
 *
 * getDirectorySize, collectExpiredFiles, measureCacheBreakdown
 * operate on the real filesystem. We test getDirectorySize on a
 * temporary directory and measureCacheBreakdown with a mocked
 * electron app path.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks for measureCacheBreakdown ---
const mockGetPath = vi.fn().mockReturnValue('/tmp/mock-user-data')
vi.mock('electron', () => ({
  app: {
    getPath: (...args: any[]) => mockGetPath(...args)
  }
}))

const { getDirectorySize, collectExpiredFiles, measureCacheBreakdown } =
  await import('@electron/core/cacheMonitor')

describe('getDirectorySize', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-monitor-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('returns zero for empty directory', async () => {
    const result = await getDirectorySize(tempDir)
    expect(result.totalBytes).toBe(0)
    expect(result.fileCount).toBe(0)
    expect(result.entrySizes.size).toBe(0)
  })

  it('counts a single file', async () => {
    writeFileSync(path.join(tempDir, 'test.txt'), 'hello')
    const result = await getDirectorySize(tempDir)
    expect(result.fileCount).toBe(1)
    expect(result.totalBytes).toBe(5)
  })

  it('counts multiple files', async () => {
    writeFileSync(path.join(tempDir, 'a.txt'), 'aaa')
    writeFileSync(path.join(tempDir, 'b.txt'), 'bbbbb')
    const result = await getDirectorySize(tempDir)
    expect(result.fileCount).toBe(2)
    expect(result.totalBytes).toBe(8)
  })

  it('traverses nested directories', async () => {
    const subDir = path.join(tempDir, 'sub')
    mkdirSync(subDir)
    writeFileSync(path.join(tempDir, 'root.txt'), '12345')
    writeFileSync(path.join(subDir, 'nested.txt'), '1234567890')
    const result = await getDirectorySize(tempDir)
    expect(result.fileCount).toBe(2)
    expect(result.totalBytes).toBe(15)
  })

  it('handles a file path (not directory)', async () => {
    const filePath = path.join(tempDir, 'single.txt')
    writeFileSync(filePath, 'data')
    const result = await getDirectorySize(filePath)
    expect(result.fileCount).toBe(1)
    expect(result.totalBytes).toBe(4)
  })

  it('handles non-existent paths gracefully', async () => {
    const result = await getDirectorySize('/nonexistent-path-12345')
    expect(result.totalBytes).toBe(0)
    expect(result.fileCount).toBe(0)
  })

  it('maps entry sizes correctly', async () => {
    const filePath = path.join(tempDir, 'entry.txt')
    writeFileSync(filePath, 'entry-data')
    const result = await getDirectorySize(tempDir)
    expect(result.entrySizes.get(filePath)).toBe(10)
  })
})

describe('collectExpiredFiles', () => {
  let tempDir: string
  const userDataPath = '/mock/user-data'

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'cache-expired-'))
    mockGetPath.mockReturnValue('/mock/user-data')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('returns empty for directory with no old files', async () => {
    writeFileSync(path.join(tempDir, 'new.txt'), 'fresh')
    // maxAge high enough that files created just now are not expired
    const expired = await collectExpiredFiles(tempDir, userDataPath, 100_000)
    expect(expired.length).toBe(0)
  })

  it('returns files older than maxAge', async () => {
    writeFileSync(path.join(tempDir, 'old.txt'), 'stale')
    await new Promise((r) => setTimeout(r, 50))
    const expired = await collectExpiredFiles(tempDir, userDataPath, 10)
    expect(expired.length).toBeGreaterThanOrEqual(1)
    expect(expired[0].size).toBeGreaterThan(0)
    expect(expired[0].absolutePath).toBeTruthy()
  })

  it('skips directories', async () => {
    mkdirSync(path.join(tempDir, 'subdir'))
    writeFileSync(path.join(tempDir, 'subdir', 'file.txt'), 'data')
    const expired = await collectExpiredFiles(tempDir, userDataPath, 0)
    // Should collect files but not the directory itself
    for (const entry of expired) {
      expect(entry.size).toBeGreaterThan(0)
    }
  })
})

describe('measureCacheBreakdown', () => {
  it('returns breakdown structure even for empty mock path', async () => {
    // The mock path doesn't exist, so all sizes should be 0
    const breakdown = await measureCacheBreakdown()
    expect(breakdown).toHaveProperty('chromiumCache')
    expect(breakdown).toHaveProperty('codeCache')
    expect(breakdown).toHaveProperty('gpuCache')
    expect(breakdown).toHaveProperty('partitionCaches')
    expect(breakdown).toHaveProperty('tempFiles')
    expect(breakdown).toHaveProperty('total')
    expect(breakdown.total).toBe(0)
  })
})
