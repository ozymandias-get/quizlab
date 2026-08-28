import { app } from 'electron'

import { APP_CONFIG } from '../../app/constants.js'
import { measureCacheBreakdown, measureSmartCacheBreakdown } from '../cacheMonitor.js'
import { Logger } from '../logger.js'
import {
  cleanupDoclingTempConversions,
  cleanupDoclingUvCache,
  cleanupOrphanedTempFiles,
  cleanupStaleDoclingRuntimes,
  formatBytes
} from './cacheCleanupHelpers.js'
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

    // Docling temp/conversions: sadece 7 günden eski orphan'lar (agresif değil)
    try {
      const conv = await cleanupDoclingTempConversions(userDataPath)
      filesDeleted += conv.deleted
      bytesFreed += conv.freed
      errors += conv.errors
    } catch (e) {
      Logger.warn('[CacheCleanup] Docling conversions cleanup failed (non-fatal):', e)
    }

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

    // Docling lifecycle: uv-cache size guard (>2GB) ve conversions TTL
    try {
      const doclingUv = await cleanupDoclingUvCache(userDataPath)
      if (doclingUv.freed > 0) {
        Logger.info(
          `[Docling] UV cache pruned: ${formatBytes(doclingUv.freed)} (${doclingUv.reason})`
        )
      }
      filesDeleted += doclingUv.deleted
      bytesFreed += doclingUv.freed
      errors += doclingUv.errors
    } catch (e) {
      Logger.warn('[Docling] UV cache cleanup failed (non-fatal):', e)
    }

    try {
      const conv = await cleanupDoclingTempConversions(userDataPath)
      filesDeleted += conv.deleted
      bytesFreed += conv.freed
      errors += conv.errors
    } catch (e) {
      Logger.warn('[Docling] Conversions cleanup failed (non-fatal):', e)
    }

    try {
      const stale = await cleanupStaleDoclingRuntimes(userDataPath)
      if (stale.removed.length > 0) {
        Logger.info(
          `[Docling] Removed stale runtime: ${stale.removed.join(', ')} (${formatBytes(stale.freed)})`
        )
      }
      filesDeleted += stale.deleted
      bytesFreed += stale.freed
      errors += stale.errors
    } catch (e) {
      Logger.warn('[Docling] Stale runtime cleanup failed (non-fatal):', e)
    }

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

    // Docling: manual cleanup her zaman uv-cache ve stale runtime'ı force prune eder
    try {
      const doclingUv = await cleanupDoclingUvCache(userDataPath, { force: true })
      if (doclingUv.freed > 0) {
        Logger.info(`[Docling] Manual UV cache pruned: ${formatBytes(doclingUv.freed)}`)
      }
      filesDeleted += doclingUv.deleted
      bytesFreed += doclingUv.freed
      errors += doclingUv.errors
    } catch (e) {
      Logger.warn('[Docling] Manual UV cache cleanup failed (non-fatal):', e)
    }

    try {
      const stale = await cleanupStaleDoclingRuntimes(userDataPath)
      if (stale.removed.length > 0) {
        Logger.info(`[Docling] Manual removed stale runtime: ${stale.removed.join(', ')}`)
      }
      filesDeleted += stale.deleted
      bytesFreed += stale.freed
      errors += stale.errors
    } catch (e) {
      Logger.warn('[Docling] Manual stale runtime cleanup failed (non-fatal):', e)
    }

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

export async function runDoclingInstallCleanup(userDataPath?: string): Promise<CleanupResult> {
  const startTime = Date.now()
  let filesDeleted = 0
  let bytesFreed = 0
  let errors = 0
  const targetPath = userDataPath ?? app.getPath('userData')

  Logger.info('[Docling] Install completed — running post-install cleanup')

  try {
    const beforeUv = await cleanupDoclingUvCache(targetPath, { force: true })
    Logger.info(
      `[Docling] UV cache size before cleanup: ${formatBytes(beforeUv.freed + (beforeUv.deleted === 0 ? 0 : 0))} — pruned: ${formatBytes(beforeUv.freed)} (${beforeUv.reason})`
    )
    filesDeleted += beforeUv.deleted
    bytesFreed += beforeUv.freed
    errors += beforeUv.errors

    const stale = await cleanupStaleDoclingRuntimes(targetPath)
    if (stale.removed.length > 0) {
      Logger.info(
        `[Docling] Active Python runtime validated — removed stale: ${stale.removed.join(', ')} (${formatBytes(stale.freed)})`
      )
    }
    filesDeleted += stale.deleted
    bytesFreed += stale.freed
    errors += stale.errors
  } catch (error) {
    Logger.warn(
      '[Docling] Post-install cleanup failed (non-fatal, component remains usable):',
      error
    )
    errors++
  }

  const duration = Date.now() - startTime
  if (bytesFreed > 0) {
    Logger.info(
      `[Docling] Post-install cleanup: ${formatBytes(bytesFreed)} freed, ${filesDeleted} entries, ${errors} errors, ${duration}ms`
    )
  }
  return buildResult(filesDeleted, bytesFreed, errors, duration)
}

export async function getCacheInfo(): Promise<CacheInfo> {
  try {
    const smartBreakdown = await measureSmartCacheBreakdown()
    const autoClean: { enabled: boolean; lastAutoCleanAt: number | null } = {
      enabled: true,
      lastAutoCleanAt: lastCleanupTime
    }

    return {
      breakdown: {
        chromiumCache: smartBreakdown.chromiumCache,
        codeCache: smartBreakdown.codeCache,
        gpuCache: smartBreakdown.gpuCache,
        partitionCaches: smartBreakdown.partitionCaches,
        tempFiles: smartBreakdown.tempFiles,
        total: smartBreakdown.total
      },
      lastCleanup: lastCleanupTime,
      lastCleanupResult,
      isIdle: isIdleState(),
      smart: {
        pressureLevel: smartBreakdown.pressureLevel,
        pressurePercentage: smartBreakdown.pressurePercentage,
        recommendation: smartBreakdown.recommendation!,
        partitionDetails: smartBreakdown.partitionDetails,
        autoClean
      }
    }
  } catch {
    // Fallback: eski yöntem
    const breakdown = await measureCacheBreakdown()
    return {
      breakdown,
      lastCleanup: lastCleanupTime,
      lastCleanupResult,
      isIdle: isIdleState()
    }
  }
}

export async function getSmartCacheInfo(): Promise<CacheInfo> {
  return getCacheInfo()
}
