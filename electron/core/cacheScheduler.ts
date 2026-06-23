/**
 * Cache Zamanlayıcı (Scheduler)
 *
 * Önbellek temizliğini periyodik olarak tetikler:
 * - Foreground (uygulama aktif): 15 dakikada bir hafif boyut kontrolü
 * - Idle (uygulama arka planda): 5 dakika sonra tam temizlik + 30 dakikada bir tekrar
 *
 * Faz 1a — Periyodik Zamanlayıcı
 * - 15 dk foreground interval
 * - Idle'da 30 dk tekrar eden cleanup
 * - Eski idle detection'ın yerini alır (daha gelişmişi)
 */
import { app } from 'electron'

import {
  runIdleCleanup,
  runQuickCheck,
  startIdleDetection,
  stopIdleDetection
} from './cacheCleanup'
import { Logger } from './logger'

const FOREGROUND_CHECK_INTERVAL_MS = 15 * 60 * 1000 // 15 dakika
const IDLE_REPEAT_INTERVAL_MS = 30 * 60 * 1000 // 30 dakika

let foregroundTimer: ReturnType<typeof setInterval> | null = null
let idleRepeatTimer: ReturnType<typeof setInterval> | null = null

function clearIdleRepeatTimer(): void {
  if (idleRepeatTimer) {
    clearInterval(idleRepeatTimer)
    idleRepeatTimer = null
  }
}

function startIdleRepeatCleanup(): void {
  clearIdleRepeatTimer()
  idleRepeatTimer = setInterval(() => {
    runIdleCleanup().catch((error) =>
      Logger.error('[CacheScheduler] Idle repeat cleanup failed:', error)
    )
  }, IDLE_REPEAT_INTERVAL_MS)
}

export function startCacheScheduler(): void {
  if (foregroundTimer) return // zaten başlatılmış

  // 1. Foreground periyodik kontrol (15 dk)
  foregroundTimer = setInterval(() => {
    runQuickCheck().catch((error) =>
      Logger.error('[CacheScheduler] Foreground quick check failed:', error)
    )
  }, FOREGROUND_CHECK_INTERVAL_MS)

  // 2. Idle detection — mevcut yapıyı kullan, tekrar eden cleanup ekle
  startIdleDetection(() => {
    runIdleCleanup().catch((error) => Logger.error('[CacheScheduler] Idle cleanup failed:', error))
    // Idle boyunca her 30 dk'da bir tekrar temizlik
    startIdleRepeatCleanup()
  })

  Logger.info(
    `[CacheScheduler] Started: foreground=${FOREGROUND_CHECK_INTERVAL_MS / 1000}s, ` +
      `idleRepeat=${IDLE_REPEAT_INTERVAL_MS / 1000}s`
  )
}

export function stopCacheScheduler(): void {
  if (foregroundTimer) {
    clearInterval(foregroundTimer)
    foregroundTimer = null
  }

  clearIdleRepeatTimer()
  stopIdleDetection()

  Logger.info('[CacheScheduler] Stopped')
}
