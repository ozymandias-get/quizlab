/**
 * Akıllı Cache Zamanlayıcı (Smart Scheduler)
 *
 * Önbellek temizliğini periyodik ve baskı bazlı tetikler:
 * - Periyodik akıllı kontrol: 5 dk'da bir boyut + baskı analizi
 * - Idle: 5 dk sonra tam temizlik + 30 dk tekrar
 * - Akıllı: %80+ dolulukta otomatik soğuk partition temizliği (throttled)
 * - Soğuk partition'lar (12s TTL) öncelikli eviction
 */
import {
  runIdleCleanup,
  runQuickCheck,
  startIdleDetection,
  stopIdleDetection
} from './cacheCleanup/index.js'
import { measureSmartCacheBreakdown, type SmartCacheBreakdown } from './cacheMonitor.js'
import { Logger } from './logger.js'
import { getCachePressure, shouldTriggerAutoClean, SMART_CACHE_CONFIG } from './smartCachePolicy.js'

const IDLE_REPEAT_INTERVAL_MS = 30 * 60 * 1000 // 30 dakika
const SMART_CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 dakika akıllı baskı kontrolü

/**
 * Foreground full-tree scans are the expensive part of the tick, not the tick
 * itself: `measureSmartCacheBreakdown()` recursively stats every file under
 * Cache/Code Cache/GPUCache of the root profile and of all 14 AI partitions.
 * Measured on the reference machine that was ~405 ms and ~6,000 sequential
 * `fs` calls for a 4.7k-file profile, i.e. ~6,000 event-loop turns inside the
 * main process while Chromium's browser-side IPC has to share the same loop.
 * A heavily used profile (the v6.4 note quoted ~76.5k files) scales that to
 * several seconds.
 *
 * The 5-minute tick therefore stays, but it only re-walks the tree when the
 * cached measurement is older than this budget; otherwise it reuses the cached
 * breakdown. Nothing about cleanup correctness changes: every delete decision
 * still comes from a fresh measurement, because `enforceSizeLimits()` re-walks
 * the tree itself before it unlinks anything, and `runQuickCheck()` is handed
 * the known total only to decide *whether* to call it.
 */
const FOREGROUND_FULL_SCAN_MIN_INTERVAL_MS = 30 * 60 * 1000 // 30 dakika

// Otomatik temizlik durumu
let lastAutoCleanAt: number | null = null
let autoCleanEnabled: boolean = SMART_CACHE_CONFIG.AUTO_CLEAN_ENABLED_DEFAULT
let isAutoCleaning = false

// Son tam ölçümün sonucu ve zamanı (foreground tick'in yeniden kullanacağı cache)
let cachedBreakdown: SmartCacheBreakdown | null = null
let cachedBreakdownAt = 0
let inFlightMeasurement: Promise<SmartCacheBreakdown> | null = null

export function getAutoCleanConfig() {
  return {
    enabled: autoCleanEnabled,
    lastAutoCleanAt,
    cooldownMs: SMART_CACHE_CONFIG.AUTO_CLEAN_COOLDOWN_MS
  }
}

export function setAutoCleanEnabled(enabled: boolean): void {
  autoCleanEnabled = enabled
  Logger.info(`[CacheScheduler] Auto-clean ${enabled ? 'enabled' : 'disabled'}`)
}

function markAutoCleanExecuted(): void {
  lastAutoCleanAt = Date.now()
}

/**
 * Returns a pressure breakdown, reusing the last full walk while it is still
 * inside `FOREGROUND_FULL_SCAN_MIN_INTERVAL_MS`.
 *
 * A walk already in flight is awaited rather than started a second time, so a
 * slow tree can never queue overlapping scans back to back.
 */
async function measurePressureWithCooldown(): Promise<{
  breakdown: SmartCacheBreakdown
  scanned: boolean
}> {
  if (inFlightMeasurement) {
    // A walk is already in progress — join it instead of starting a second one,
    // so a slow tree can never stack overlapping scans on the main-process loop.
    return { breakdown: await inFlightMeasurement, scanned: false }
  }

  const now = Date.now()
  if (cachedBreakdown && now - cachedBreakdownAt < FOREGROUND_FULL_SCAN_MIN_INTERVAL_MS) {
    return { breakdown: cachedBreakdown, scanned: false }
  }

  const pending = measureSmartCacheBreakdown().then((breakdown) => {
    cachedBreakdown = breakdown
    cachedBreakdownAt = Date.now()
    return breakdown
  })
  inFlightMeasurement = pending
  try {
    return { breakdown: await pending, scanned: true }
  } finally {
    inFlightMeasurement = null
  }
}

/**
 * Akıllı foreground kontrol: boyut + TTL + baskı seviyesi
 * Baskı yüksekse otomatik temizlik tetikler (throttled)
 */
async function runSmartForegroundCheck(): Promise<void> {
  try {
    const { breakdown, scanned } = await measurePressureWithCooldown()
    if (!scanned) {
      Logger.debug(
        `[CacheScheduler] Reusing cache measurement (age=${Math.round(
          (Date.now() - cachedBreakdownAt) / 1000
        )}s, budget=${FOREGROUND_FULL_SCAN_MIN_INTERVAL_MS / 1000}s)`
      )
    }

    const pressure = getCachePressure(breakdown.total)

    if (pressure.level !== 'normal') {
      const rec = breakdown.recommendation
      Logger.info(
        `[CacheScheduler] Pressure ${pressure.level} ${pressure.percentage.toFixed(1)}% (${(pressure.usedBytes / 1024 / 1024).toFixed(1)}MB / ${(pressure.limitBytes / 1024 / 1024).toFixed(0)}MB)` +
          (rec && rec.action !== 'none'
            ? ` → recommend ${rec.action} ${rec.targetPartitions.join(',')}`
            : '')
      )
    }

    // Akıllı otomatik temizlik tetikleme
    const autoConfig = getAutoCleanConfig()
    if (shouldTriggerAutoClean(pressure, autoConfig)) {
      if (isAutoCleaning) return
      isAutoCleaning = true
      try {
        Logger.info(`[CacheScheduler] Auto-clean triggered (pressure=${pressure.level})`)
        // Yüksek baskıda idle cleanup benzeri ama daha hafif: sadece expired + size limit
        // Kritikse deep kadar agresif
        if (pressure.level === 'critical' || pressure.level === 'high') {
          await runIdleCleanup()
        } else {
          // Deep cleanup ölçümü kendi içinde yapar; bu dalda zaten elimizde
          // ölçülmüş toplam var, tekrar tarama gereksiz.
          await runQuickCheck(breakdown.total)
        }
        markAutoCleanExecuted()
      } finally {
        isAutoCleaning = false
      }
      return
    }

    // Normal akış: toplam boyut zaten yukarıda ölçüldü, aynı ağacı ikinci kez
    // taramadan yalnızca limit kontrolü + gerekiyorsa temizlik yapılır.
    await runQuickCheck(breakdown.total)
  } catch (error) {
    Logger.error('[CacheScheduler] Smart foreground check failed:', error)
    // Fallback to legacy quick check
    await runQuickCheck().catch((e) =>
      Logger.error('[CacheScheduler] Fallback quick check failed:', e)
    )
  }
}

let idleRepeatTimer: ReturnType<typeof setInterval> | null = null
let smartTimer: ReturnType<typeof setInterval> | null = null

function clearIdleRepeatTimer(): void {
  if (idleRepeatTimer) {
    clearInterval(idleRepeatTimer)
    idleRepeatTimer = null
  }
}

function clearSmartTimer(): void {
  if (smartTimer) {
    clearInterval(smartTimer)
    smartTimer = null
  }
}

function unrefTimer(timer: ReturnType<typeof setInterval> | null): void {
  if (
    timer &&
    typeof timer === 'object' &&
    timer !== null &&
    'unref' in timer &&
    typeof (timer as unknown as { unref: () => void }).unref === 'function'
  ) {
    ;(timer as unknown as { unref: () => void }).unref()
  }
}

function startIdleRepeatCleanup(): void {
  clearIdleRepeatTimer()
  idleRepeatTimer = setInterval(() => {
    runIdleCleanup().catch((error) =>
      Logger.error('[CacheScheduler] Idle repeat cleanup failed:', error)
    )
  }, IDLE_REPEAT_INTERVAL_MS)
  unrefTimer(idleRepeatTimer)
}

function startSmartPressureWatcher(): void {
  clearSmartTimer()
  smartTimer = setInterval(() => {
    void runSmartForegroundCheck()
  }, SMART_CHECK_INTERVAL_MS)
  unrefTimer(smartTimer)
}

export function startCacheScheduler(): void {
  if (smartTimer) return // zaten başlatılmış

  // Periyodik akıllı kontrol (5 dk): boyut + baskı seviyesi + gerekirse
  // otomatik temizlik. Ayrı bir 15 dk foreground timer'ı yok: 15, 5'in katı
  // olduğu için aynı fonksiyon her 15 dakikada zaten çalışıyordu — ikinci
  // timer yalnızca aynı tam ağacı taramayı tekrarlıyordu.
  startSmartPressureWatcher()

  // Idle detection — mevcut yapıyı kullan, tekrar eden cleanup ekle
  startIdleDetection(() => {
    runIdleCleanup().catch((error) => Logger.error('[CacheScheduler] Idle cleanup failed:', error))
    // Idle boyunca her 30 dk'da bir tekrar temizlik
    startIdleRepeatCleanup()
  })

  Logger.info(
    `[CacheScheduler] Started: smart=${SMART_CHECK_INTERVAL_MS / 1000}s, ` +
      `fullScanMin=${FOREGROUND_FULL_SCAN_MIN_INTERVAL_MS / 1000}s, ` +
      `idleRepeat=${IDLE_REPEAT_INTERVAL_MS / 1000}s ` +
      `(autoClean=${autoCleanEnabled ? 'on' : 'off'})`
  )
}

export function stopCacheScheduler(): void {
  clearSmartTimer()
  clearIdleRepeatTimer()
  stopIdleDetection()

  // Drop the cached measurement with the scheduler: a later restart must take a
  // fresh reading rather than trust a breakdown from a previous run.
  cachedBreakdown = null
  cachedBreakdownAt = 0

  Logger.info('[CacheScheduler] Stopped')
}
