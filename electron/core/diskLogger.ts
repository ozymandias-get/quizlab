import fs from 'fs'
import path from 'path'

import {
  getLogBufferLength,
  getPendingLogEntries,
  getTotalLogCount
} from '../../src/shared/lib/logger.js'

let diskLogPath: string | null = null
// Absolute count of entries already flushed (see getTotalLogCount). Raw
// buffer indices would shift every time the ring buffer trims itself,
// permanently stalling disk logging once the buffer saturates.
let lastFlushedCount = 0
let flushIntervalTimer: ReturnType<typeof setInterval> | null = null
let cleanupIntervalTimer: ReturnType<typeof setInterval> | null = null
const FLUSH_INTERVAL_MS = 30_000
const CLEANUP_INTERVAL_MS = 3_600_000
const LOG_RETENTION_DAYS = 7

export function initLogger(options?: { userDataPath?: string; logToDisk?: boolean }): void {
  if (!options?.userDataPath) return

  const logDir = path.join(options.userDataPath, 'logs')
  diskLogPath = logDir

  startFlushInterval()
  startCleanupInterval()
}

function startFlushInterval(): void {
  stopFlushInterval()
  flushIntervalTimer = setInterval(() => {
    flushToDisk().catch(() => {})
  }, FLUSH_INTERVAL_MS)
  if (
    flushIntervalTimer &&
    typeof flushIntervalTimer === 'object' &&
    'unref' in flushIntervalTimer
  ) {
    flushIntervalTimer.unref()
  }
}

function stopFlushInterval(): void {
  if (flushIntervalTimer) {
    clearInterval(flushIntervalTimer)
    flushIntervalTimer = null
  }
}

function startCleanupInterval(): void {
  stopCleanupInterval()
  cleanupIntervalTimer = setInterval(() => {
    void cleanOldLogs()
  }, CLEANUP_INTERVAL_MS)
  if (
    cleanupIntervalTimer &&
    typeof cleanupIntervalTimer === 'object' &&
    'unref' in cleanupIntervalTimer
  ) {
    cleanupIntervalTimer.unref()
  }
}

function stopCleanupInterval(): void {
  if (cleanupIntervalTimer) {
    clearInterval(cleanupIntervalTimer)
    cleanupIntervalTimer = null
  }
}

let flushInProgress = false
let pendingFlush = false

export async function flushToDisk(): Promise<void> {
  if (!diskLogPath) return
  if (flushInProgress) {
    pendingFlush = true
    return
  }
  flushInProgress = true
  try {
    // Map the absolute "already flushed" count onto current buffer indices:
    // the buffer keeps only the newest `length` entries of `total` ever
    // logged, so entry N lives at index max(0, length - (total - N)).
    const total = getTotalLogCount()
    const bufferSize = getLogBufferLength()
    const fromIndex = Math.max(0, bufferSize - (total - lastFlushedCount))
    const entries = getPendingLogEntries(fromIndex)
    if (entries.length === 0) return

    try {
      const logDir = diskLogPath!
      await fs.promises.mkdir(logDir, { recursive: true })

      const dateStr = new Date().toISOString().slice(0, 10)
      const logFile = path.join(logDir, `quizlab-${dateStr}.log`)

      const lines = entries.map((e) => `[${e.timestamp}] [${e.level.toUpperCase()}] ${e.message}`)
      await fs.promises.appendFile(logFile, lines.join('\n') + '\n', 'utf-8')

      lastFlushedCount = total
    } catch {
      // Write failure is non-critical; retry with the same window next flush.
    }
  } finally {
    flushInProgress = false
    if (pendingFlush) {
      pendingFlush = false
      // Coalesce rapid flush requests — schedule next flush on next tick
      setImmediate(() => {
        void flushToDisk()
      })
    }
  }
}

async function cleanOldLogs(): Promise<void> {
  if (!diskLogPath) return
  const logDir = diskLogPath

  try {
    try {
      await fs.promises.access(logDir)
    } catch {
      return
    }

    const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const files = await fs.promises.readdir(logDir)

    await Promise.all(
      files.map(async (file) => {
        if (!file.startsWith('quizlab-') || !file.endsWith('.log')) return
        const filePath = path.join(logDir, file)
        try {
          const stat = await fs.promises.stat(filePath)
          if (stat.isFile() && stat.mtimeMs < cutoff) {
            await fs.promises.unlink(filePath)
          }
        } catch {
          // Single file failure is non-critical
        }
      })
    )
  } catch {
    // Cleanup failure is non-critical
  }
}
