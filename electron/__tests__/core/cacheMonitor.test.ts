/**
 * Tests for electron/core/cacheMonitor.ts
 *
 * getDirectorySize, collectExpiredFiles, measureCacheBreakdown
 * operate on the real filesystem. We test getDirectorySize on a
 * temporary directory and measureCacheBreakdown with a mocked
 * electron app path.
 */
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  })

  it('counts and sums files across a nested tree, and accepts a bare file path', async () => {
    const subDir = path.join(tempDir, 'sub')
    mkdirSync(subDir)
    writeFileSync(path.join(tempDir, 'a.txt'), 'aaa')
    writeFileSync(path.join(tempDir, 'b.txt'), 'bbbbb')
    writeFileSync(path.join(subDir, 'c.txt'), '1234567890')

    const nested = await getDirectorySize(tempDir)
    expect(nested.fileCount).toBe(3)
    expect(nested.totalBytes).toBe(18)

    const asFile = await getDirectorySize(path.join(tempDir, 'a.txt'))
    expect(asFile.fileCount).toBe(1)
    expect(asFile.totalBytes).toBe(3)
  })

  it('handles non-existent paths gracefully', async () => {
    const result = await getDirectorySize('/nonexistent-path-12345')
    expect(result.totalBytes).toBe(0)
    expect(result.fileCount).toBe(0)
  })

  it('exposes only aggregate totals, with no per-file accumulation', async () => {
    // The walk used to build an `entrySizes` Map with one entry per file, which
    // nothing in production read and which cost ~8% of every cache scheduler
    // tick on a realistic cache tree. The result shape is pinned here so the
    // dead per-file state cannot quietly come back.
    const subDir = path.join(tempDir, 'sub')
    mkdirSync(subDir)
    writeFileSync(path.join(tempDir, 'a.txt'), 'aaa')
    writeFileSync(path.join(subDir, 'b.txt'), 'bbbb')

    const result = await getDirectorySize(tempDir)

    expect(Object.keys(result).sort()).toEqual(['fileCount', 'totalBytes'])
    expect(result.fileCount).toBe(2)
    expect(result.totalBytes).toBe(7)
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

  it('collects files at every depth but never returns a directory entry', async () => {
    const subDir = path.join(tempDir, 'subdir')
    mkdirSync(subDir)
    const nestedFile = path.join(subDir, 'file.txt')
    writeFileSync(nestedFile, 'data')
    // Backdate the mtime instead of sleeping, so the "old enough" precondition
    // is deterministic. (The case this replaces passed a maxAge of 0, which
    // does NOT expire a just-created file — its assertion loop simply never
    // ran.)
    const stale = new Date(Date.now() - 60_000)
    utimesSync(nestedFile, stale, stale)

    const expired = await collectExpiredFiles(tempDir, userDataPath, 1_000)

    expect(expired.length).toBe(1)
    const [entry] = expired
    expect(entry.absolutePath).toBe(nestedFile)
    expect(entry.size).toBeGreaterThan(0)
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
