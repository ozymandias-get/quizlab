/**
 * Akıllı Cache Zamanlayıcı (Smart Scheduler)
 *
 * Önbellek temizliğini periyodik ve baskı bazlı tetikler:
 * - Foreground: 15 dk hafif kontrol + baskı analizi
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
import { measureSmartCacheBreakdown } from './cacheMonitor.js'
import { Logger } from './logger.js'
import { getCachePressure, shouldTriggerAutoClean, SMART_CACHE_CONFIG } from './smartCachePolicy.js'

const FOREGROUND_CHECK_INTERVAL_MS = 15 * 60 * 1000 // 15 dakika
const IDLE_REPEAT_INTERVAL_MS = 30 * 60 * 1000 // 30 dakika
const SMART_CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 dakika akıllı baskı kontrolü

// Otomatik temizlik durumu
let lastAutoCleanAt: number | null = null
let autoCleanEnabled: boolean = SMART_CACHE_CONFIG.AUTO_CLEAN_ENABLED_DEFAULT
let isAutoCleaning = false

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

export function getLastAutoCleanTime(): number | null {
  return lastAutoCleanAt
}

function markAutoCleanExecuted(): void {
  lastAutoCleanAt = Date.now()
}

/**
 * Akıllı foreground kontrol: boyut + TTL + baskı seviyesi
 * Baskı yüksekse otomatik temizlik tetikler (throttled)
 */
async function runSmartForegroundCheck(): Promise<void> {
  try {
    const breakdown = await measureSmartCacheBreakdown()
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
          await runQuickCheck()
          // Ek olarak soğuk partition'ların süresi dolmuş dosyalarını temizle
          const { runIdleCleanup: doIdle } = await import('./cacheCleanup/index.js')
          // warning seviyesinde idle cleanup yarısı kadar: sadece 1 kez extra
          if (pressure.level === 'warning') {
            // zaten quickCheck size limit yaptı, warning'de ek idle gerekmez - logla
          }
        }
        markAutoCleanExecuted()
      } finally {
        isAutoCleaning = false
      }
      return
    }

    // Normal akış: sadece hızlı boyut kontrolü (eski davranış)
    await runQuickCheck()
  } catch (error) {
    Logger.error('[CacheScheduler] Smart foreground check failed:', error)
    // Fallback to legacy quick check
    await runQuickCheck().catch((e) =>
      Logger.error('[CacheScheduler] Fallback quick check failed:', e)
    )
  }
}

let foregroundTimer: ReturnType<typeof setInterval> | null = null
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
  if (foregroundTimer) return // zaten başlatılmış

  // 1. Foreground periyodik kontrol (15 dk) – akıllı versiyon
  foregroundTimer = setInterval(() => {
    void runSmartForegroundCheck()
  }, FOREGROUND_CHECK_INTERVAL_MS)
  unrefTimer(foregroundTimer)

  // 2. Ek akıllı baskı izleyici (5 dk) – %80+ dolulukta erken müdahale
  startSmartPressureWatcher()

  // 3. Idle detection — mevcut yapıyı kullan, tekrar eden cleanup ekle
  startIdleDetection(() => {
    runIdleCleanup().catch((error) => Logger.error('[CacheScheduler] Idle cleanup failed:', error))
    // Idle boyunca her 30 dk'da bir tekrar temizlik
    startIdleRepeatCleanup()
  })

  Logger.info(
    `[CacheScheduler] Started: foreground=${FOREGROUND_CHECK_INTERVAL_MS / 1000}s, ` +
      `smart=${SMART_CHECK_INTERVAL_MS / 1000}s, idleRepeat=${IDLE_REPEAT_INTERVAL_MS / 1000}s ` +
      `(autoClean=${autoCleanEnabled ? 'on' : 'off'})`
  )
}

export function stopCacheScheduler(): void {
  if (foregroundTimer) {
    clearInterval(foregroundTimer)
    foregroundTimer = null
  }

  clearIdleRepeatTimer()
  clearSmartTimer()
  stopIdleDetection()

  Logger.info('[CacheScheduler] Stopped')
}

// Test / manual trigger için
export async function triggerSmartCheck(): Promise<void> {
  await runSmartForegroundCheck()
}
