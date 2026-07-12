import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetPendingLogEntries = vi.fn()
const mockGetLogBufferLength = vi.fn()

vi.mock('../../../src/shared/lib/logger.js', () => ({
  getPendingLogEntries: (...args: any[]) => mockGetPendingLogEntries(...args),
  getLogBufferLength: (...args: any[]) => mockGetLogBufferLength(...args)
}))

const mockExistsSync = vi.fn()
const mockMkdirSync = vi.fn()
const mockAppendFileSync = vi.fn()
const mockReaddirSync = vi.fn()
const mockStatSync = vi.fn()
const mockUnlinkSync = vi.fn()

vi.mock('fs', () => ({
  default: {
    existsSync: (...args: any[]) => mockExistsSync(...args),
    mkdirSync: (...args: any[]) => mockMkdirSync(...args),
    appendFileSync: (...args: any[]) => mockAppendFileSync(...args),
    readdirSync: (...args: any[]) => mockReaddirSync(...args),
    statSync: (...args: any[]) => mockStatSync(...args),
    unlinkSync: (...args: any[]) => mockUnlinkSync(...args)
  },
  existsSync: (...args: any[]) => mockExistsSync(...args),
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
  appendFileSync: (...args: any[]) => mockAppendFileSync(...args),
  readdirSync: (...args: any[]) => mockReaddirSync(...args),
  statSync: (...args: any[]) => mockStatSync(...args),
  unlinkSync: (...args: any[]) => mockUnlinkSync(...args)
}))

describe('diskLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initLogger does nothing without userDataPath', async () => {
    const { initLogger } = await import('../../core/diskLogger.js')
    initLogger({})
    expect(mockMkdirSync).not.toHaveBeenCalled()
  })

  it('flushToDisk does nothing when not initialized', async () => {
    const { flushToDisk } = await import('../../core/diskLogger.js')
    await expect(flushToDisk()).resolves.toBeUndefined()
  })

  it('formatBytes returns correct string', async () => {
    const { formatBytes } = await import('../../core/cacheCleanup/cacheCleanupHelpers.js')
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1048576)).toBe('1.0 MB')
    expect(formatBytes(1572864)).toBe('1.5 MB')
  })
})
