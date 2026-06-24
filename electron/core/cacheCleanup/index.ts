import { app } from 'electron'

import { APP_CONFIG } from '../../app/constants.js'
import { measureCacheBreakdown } from '../cacheMonitor.js'
import { Logger } from '../logger.js'
import { cleanupOrphanedTempFiles, formatBytes } from './cacheCleanupHelpers.js'
import { isIdleState, startIdleDetection, stopIdleDetection } from './idle.js'
import { cleanupExpiredCacheFiles, enforceSizeLimits } from './operations.js'
import type { CacheInfo, CleanupResult } from './types.js'

export { startIdleDetection, stopIdleDetection } from './idle.js'
export type { CacheInfo, CleanupResult } from './types.js'

const { MAX_TOTAL_CACHE_BYTES } = APP_CONFIG.CLEANUP
const STARTUP_CLEANUP_COOLDOWN_MS = 4 * 60 * 60 * 1000 // 4 saat

let lastCleanupTime: number | null = null
let lastCleanupResult: CleanupResult | null = null
let startupCleanupCooldownUntil = 0

function buildResult(
  filesDeleted: number,
  bytesFreed: number,
  errors: number,
  duration: number
): CleanupResult {
  return { filesDeleted, bytesFreed, errors, duration }
}

/**
 * Hafif foreground kontrolü: sadece toplam boyut ölçülür,
 * limit aşıldıysa enforceSizeLimits çalıştırılır.
 * Tam TTL taraması yapılmaz — idle/manual cleanup'e bırakılır.
 */
export async function runQuickCheck(): Promise<CleanupResult> {
  const startTime = Date.now()
  let filesDeleted = 0
  let bytesFreed = 0
  let errors = 0

  try {
    const userDataPath = app.getPath('userData')
    const breakdown = await measureCacheBreakdown()

    if (breakdown.total > MAX_TOTAL_CACHE_BYTES) {
      const sizeResult = await enforceSizeLimits(userDataPath)
      filesDeleted += sizeResult.deleted
      bytesFreed += sizeResult.freed
      errors += sizeResult.errors
    }
  } catch (error) {
    Logger.error('[CacheCleanup] Quick check error:', error)
    errors++
  }

  const duration = Date.now() - startTime

  if (filesDeleted > 0 || errors > 0) {
    Logger.info(
      `[CacheCleanup] Quick check: ${filesDeleted} files, ${formatBytes(bytesFreed)} freed, ${errors} errors, ${duration}ms`
    )
  }

  return buildResult(filesDeleted, bytesFreed, errors, duration)
}

export async function runStartupCleanup(): Promise<CleanupResult> {
  const now = Date.now()
  if (now < startupCleanupCooldownUntil) {
    return buildResult(0, 0, 0, 0)
  }

  const startTime = Date.now()
  let filesDeleted = 0
  let bytesFreed = 0
  let errors = 0

  try {
    const userDataPath = app.getPath('userData')

    const tempResult = await cleanupOrphanedTempFiles(userDataPath)
    filesDeleted += tempResult.deleted
    bytesFreed += tempResult.freed
    errors += tempResult.errors

    // Kullanıcı oturum profilleri startup'ta temizlenmez —
    // kullanıcı oturumları silinmesin diye otomatik temizlikten muaftır.
    // Oturumu sıfırlamak için ayarlardaki "Profili Sıfırla" işlemi kullanılır.

    const breakdown = await measureCacheBreakdown()
    if (breakdown.total > MAX_TOTAL_CACHE_BYTES) {
      const sizeResult = await enforceSizeLimits(userDataPath)
      filesDeleted += sizeResult.deleted
      bytesFreed += sizeResult.freed
      errors += sizeResult.errors
    }
  } catch (error) {
    Logger.error('[CacheCleanup] Startup cleanup error:', error)
    errors++
  }

  const duration = Date.now() - startTime
  const result = buildResult(filesDeleted, bytesFreed, errors, duration)
  lastCleanupTime = Date.now()
  lastCleanupResult = result
  startupCleanupCooldownUntil = now + STARTUP_CLEANUP_COOLDOWN_MS

  Logger.info(
    `[CacheCleanup] Completed: ${filesDeleted} files, ${formatBytes(bytesFreed)} freed, ${errors} errors, ${duration}ms ` +
      `(next startup cleanup in ${STARTUP_CLEANUP_COOLDOWN_MS / 1000 / 60 / 60}h)`
  )

  return result
}

export async function runIdleCleanup(): Promise<CleanupResult> {
  const startTime = Date.now()
  let filesDeleted = 0
  let bytesFreed = 0
  let errors = 0

  try {
    const userDataPath = app.getPath('userData')

    const tempResult = await cleanupOrphanedTempFiles(userDataPath)
    filesDeleted += tempResult.deleted
    bytesFreed += tempResult.freed
    errors += tempResult.errors

    const cacheResult = await cleanupExpiredCacheFiles(userDataPath)
    filesDeleted += cacheResult.deleted
    bytesFreed += cacheResult.freed
    errors += cacheResult.errors

    const sizeResult = await enforceSizeLimits(userDataPath)
    filesDeleted += sizeResult.deleted
    bytesFreed += sizeResult.freed
    errors += sizeResult.errors
  } catch (error) {
    Logger.error('[CacheCleanup] Idle cleanup error:', error)
    errors++
  }

  const duration = Date.now() - startTime
  const result = buildResult(filesDeleted, bytesFreed, errors, duration)
  lastCleanupTime = Date.now()
  lastCleanupResult = result

  if (filesDeleted > 0 || errors > 0) {
    Logger.info(
      `[CacheCleanup] Idle completed: ${filesDeleted} files, ${formatBytes(bytesFreed)} freed, ${errors} errors, ${duration}ms`
    )
  }

  return result
}

export async function runManualCleanup(): Promise<CleanupResult> {
  const startTime = Date.now()
  let filesDeleted = 0
  let bytesFreed = 0
  let errors = 0

  try {
    const userDataPath = app.getPath('userData')

    const tempResult = await cleanupOrphanedTempFiles(userDataPath)
    filesDeleted += tempResult.deleted
    bytesFreed += tempResult.freed
    errors += tempResult.errors

    // Kullanıcı oturum profilleri manuel önbellek temizliğinde silinmez.
    // Oturumu sıfırlamak için ayarlardaki "Profili Sıfırla" işlemi kullanılır.

    const cacheResult = await cleanupExpiredCacheFiles(userDataPath)
    filesDeleted += cacheResult.deleted
    bytesFreed += cacheResult.freed
    errors += cacheResult.errors

    const sizeResult = await enforceSizeLimits(userDataPath)
    filesDeleted += sizeResult.deleted
    bytesFreed += sizeResult.freed
    errors += sizeResult.errors
  } catch (error) {
    Logger.error('[CacheCleanup] Manual cleanup error:', error)
    errors++
  }

  const duration = Date.now() - startTime
  const result = buildResult(filesDeleted, bytesFreed, errors, duration)
  lastCleanupTime = Date.now()
  lastCleanupResult = result

  Logger.info(
    `[CacheCleanup] Manual completed: ${filesDeleted} files, ${formatBytes(bytesFreed)} freed, ${errors} errors, ${duration}ms`
  )

  return result
}

export async function getCacheInfo(): Promise<CacheInfo> {
  const breakdown = await measureCacheBreakdown()
  return {
    breakdown,
    lastCleanup: lastCleanupTime,
    lastCleanupResult,
    isIdle: isIdleState()
  }
}
