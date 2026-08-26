/**
 * Regression tests for disk logger flush bookkeeping.
 *
 * Bug: lastFlushedIndex was a raw index into a ring buffer that trims itself
 * to LOG_BUFFER_LIMIT. Once the buffer saturated, the stored index pointed
 * past the end of the (shifted) buffer forever, so `slice(index)` returned
 * nothing and disk logging silently stopped for the rest of the session.
 *
 * The fix tracks an absolute "entries ever logged" count and maps it onto
 * current buffer indices at flush time.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const appendFileMock = vi.fn()
const mkdirMock = vi.fn()

vi.mock('fs', () => ({
  default: {
    promises: {
      mkdir: (...args: unknown[]) => mkdirMock(...args),
      appendFile: (...args: unknown[]) => appendFileMock(...args)
    }
  },
  promises: {
    mkdir: (...args: unknown[]) => mkdirMock(...args),
    appendFile: (...args: unknown[]) => appendFileMock(...args)
  }
}))

// Minimal in-memory ring buffer mirroring src/shared/lib/logger semantics.
const LOG_BUFFER_LIMIT = 400
interface Entry {
  timestamp: string
  level: string
  message: string
}
const logBuffer: Entry[] = []
let totalLogged = 0

function pushEntry(level: string, message: string): void {
  logBuffer.push({ timestamp: 'T', level, message })
  totalLogged++
  if (logBuffer.length > LOG_BUFFER_LIMIT) {
    logBuffer.splice(0, logBuffer.length - LOG_BUFFER_LIMIT)
  }
}

vi.mock('../../../src/shared/lib/logger.js', () => ({
  getPendingLogEntries: (fromIndex: number) => logBuffer.slice(fromIndex),
  getLogBufferLength: () => logBuffer.length,
  getTotalLogCount: () => totalLogged
}))

describe('diskLogger flushToDisk bookkeeping', () => {
  beforeEach(() => {
    vi.resetModules()
    logBuffer.length = 0
    totalLogged = 0
    appendFileMock.mockReset().mockResolvedValue(undefined)
    mkdirMock.mockReset().mockResolvedValue(undefined)
  })

  it('continues flushing after the buffer has saturated (regression)', async () => {
    const { initLogger, flushToDisk } = await import('../../core/diskLogger.js')
    initLogger({ userDataPath: '/ud' })

    // Saturate the buffer and flush: index bookkeeping must record the
    // absolute count, not the saturated length.
    for (let i = 0; i < 400; i++) pushEntry('info', `m${i}`)
    await flushToDisk()
    expect(appendFileMock).toHaveBeenCalledTimes(1)

    // Buffer is now permanently full; new logs shift old ones out. Before
    // the fix, slice(400) stayed empty forever and nothing was written.
    pushEntry('info', 'after-saturation-1')
    pushEntry('warn', 'after-saturation-2')
    await flushToDisk()

    expect(appendFileMock).toHaveBeenCalledTimes(2)
    const secondWrite = appendFileMock.mock.calls[1][1] as string
    expect(secondWrite).toContain('after-saturation-1')
    expect(secondWrite).toContain('after-saturation-2')
  })

  it('does not skip entries that wrap around during trimming', async () => {
    const { initLogger, flushToDisk } = await import('../../core/diskLogger.js')
    initLogger({ userDataPath: '/ud' })

    for (let i = 0; i < 350; i++) pushEntry('info', `pre-${i}`)
    await flushToDisk()

    // 100 new entries force a trim of the 50 oldest unflushed... none here:
    // all pre-* were flushed, so trimming only drops flushed entries.
    for (let i = 0; i < 100; i++) pushEntry('info', `post-${i}`)
    await flushToDisk()

    expect(appendFileMock).toHaveBeenCalledTimes(2)
    const secondWrite = appendFileMock.mock.calls[1][1] as string
    expect(secondWrite).not.toContain('pre-0 ')
    expect(secondWrite).toContain('post-0')
    expect(secondWrite).toContain('post-99')

    // A third flush with no new entries must not rewrite anything.
    await flushToDisk()
    expect(appendFileMock).toHaveBeenCalledTimes(2)
  })

  it('keeps entries pending when the write fails so they are retried', async () => {
    const { initLogger, flushToDisk } = await import('../../core/diskLogger.js')
    initLogger({ userDataPath: '/ud' })

    pushEntry('error', 'boom')
    appendFileMock.mockRejectedValueOnce(new Error('disk full'))
    await flushToDisk()
    expect(appendFileMock).toHaveBeenCalledTimes(1)

    appendFileMock.mockResolvedValueOnce(undefined)
    await flushToDisk()
    expect(appendFileMock).toHaveBeenCalledTimes(2)
    expect(appendFileMock.mock.calls[1][1] as string).toContain('boom')
  })
})
