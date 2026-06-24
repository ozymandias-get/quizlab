import fs from 'fs'
import path from 'path'

import { getLogBufferLength, getPendingLogEntries } from '../../src/shared/lib/logger.js'

let diskLogPath: string | null = null
let lastFlushedIndex = 0
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
    cleanOldLogs()
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

export async function flushToDisk(): Promise<void> {
  if (!diskLogPath) return

  const entries = getPendingLogEntries(lastFlushedIndex)
  if (entries.length === 0) return

  try {
    if (!fs.existsSync(diskLogPath)) {
      fs.mkdirSync(diskLogPath, { recursive: true })
    }

    const dateStr = new Date().toISOString().slice(0, 10)
    const logFile = path.join(diskLogPath, `quizlab-${dateStr}.log`)

    const lines = entries.map((e) => `[${e.timestamp}] [${e.level.toUpperCase()}] ${e.message}`)
    fs.appendFileSync(logFile, lines.join('\n') + '\n', 'utf-8')

    lastFlushedIndex = getLogBufferLength()
  } catch {
    // Write failure is non-critical
  }
}

function cleanOldLogs(): void {
  if (!diskLogPath) return

  try {
    if (!fs.existsSync(diskLogPath)) return

    const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const files = fs.readdirSync(diskLogPath)

    for (const file of files) {
      if (!file.startsWith('quizlab-') || !file.endsWith('.log')) continue
      const filePath = path.join(diskLogPath, file)
      const stat = fs.statSync(filePath)
      if (stat.isFile() && stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath)
      }
    }
  } catch {
    // Cleanup failure is non-critical
  }
}
