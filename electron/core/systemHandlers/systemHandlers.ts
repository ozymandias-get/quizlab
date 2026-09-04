import { app, clipboard, ipcMain, session, shell, webContents } from 'electron'

import { success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { getMainWindow } from '../../app/windowManager.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { runCleanup } from '../appCleanup.js'
import { getCacheInfo, runManualCleanup } from '../cacheCleanup/index.js'
import { requireTrustedIpcSender } from '../ipcSecurity.js'
import { pushToLoggerBuffer } from '../logger.js'
import { Logger } from '../logger.js'
import {
  clearSafeCacheDirectories,
  getAllPartitions,
  getCachedCacheInfo,
  invalidateCacheInfo,
  isMainWindowGuestContents,
  MODEL_STORAGE_TYPES,
  protectedPartitions,
  resolveAiModelPartition,
  setCachedCacheInfo
} from './cache.js'
import { sanitizeClipboardText } from './clipboard.js'

const { IPC_CHANNELS } = APP_CONFIG
let handlersRegistered = false

const EMPTY_CACHE_INFO: Awaited<ReturnType<typeof getCacheInfo>> = {
  breakdown: {
    chromiumCache: 0,
    codeCache: 0,
    gpuCache: 0,
    partitionCaches: {},
    tempFiles: 0,
    total: 0
  },
  lastCleanup: null,
  lastCleanupResult: null,
  isIdle: false
}

export function registerSystemHandlers() {
  if (handlersRegistered) return
  handlersRegistered = true

  registerIpcHandler(
    IPC_CHANNELS.APP_QUIT,
    async () => {
      await runCleanup()

      setImmediate(() => {
        app.quit()
      })

      return success(true)
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.OPEN_EXTERNAL,
    async (event, url: string) => {
      if (!url || typeof url !== 'string') return success(false)

      const FORBIDDEN_PATTERN = /[\x00-\x1f\x7f-\x9f]/
      if (FORBIDDEN_PATTERN.test(url)) return success(false)

      if (url.startsWith('//')) return success(false)

      if (!url.startsWith('mailto:')) {
        try {
          const parsedForCredCheck = new URL(url)
          if (parsedForCredCheck.username || parsedForCredCheck.password) return success(false)
        } catch {
          if (url.includes('@')) return success(false)
        }
      }

      try {
        const parsedUrl = new URL(url)
        const allowedProtocols = ['https:', 'mailto:']

        if (!allowedProtocols.includes(parsedUrl.protocol)) return success(false)

        const rawProtocolMatch = allowedProtocols.some((p) => url.startsWith(p))
        if (!rawProtocolMatch) return success(false)

        if (parsedUrl.protocol === 'https:') {
          const host = parsedUrl.hostname.toLowerCase()

          const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/
          if (IP_RE.test(host)) return success(false)

          // URL.hostname keeps brackets for IPv6 literals ("[::1]").
          if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]')
            return success(false)

          if (!host.includes('.')) return success(false)
        }

        await shell.openExternal(parsedUrl.toString())
        return success(true)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        Logger.error(`[IPC] External link error:`, message)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.FORCE_PASTE,
    async (event, webContentsId: number) => {
      try {
        if (!webContentsId) return success(false)
        const contents = webContents.fromId(webContentsId)

        if (contents && isMainWindowGuestContents(contents)) {
          contents.paste()
          return success(true)
        }
        return success(false)
      } catch (error) {
        Logger.error('[IPC] Force paste failed:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.CLEAR_CACHE,
    async () => {
      try {
        const userDataPath = app.getPath('userData')

        await session.defaultSession.clearCache()

        const allPartitions = getAllPartitions()

        const filtered = [...allPartitions].filter((partition) => {
          if (protectedPartitions.has(partition)) {
            Logger.warn(
              `[systemHandlers] Skipping CLEAR_CACHE for protected partition "${partition}" — active sessions are using it`
            )
            return false
          }
          return true
        })

        const clearPromises = filtered.map(async (partition) => {
          const pSession = session.fromPartition(partition)
          await pSession.clearCache()
          await pSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] })
        })

        await Promise.all(clearPromises)
        await clearSafeCacheDirectories(userDataPath, new Set(filtered))
        invalidateCacheInfo()

        return success(true)
      } catch (error) {
        Logger.error('[IPC] Failed to clear cache:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.CLEAR_AI_MODEL_DATA,
    async (event, input: { id?: unknown; partition?: unknown }) => {
      try {
        const partition = resolveAiModelPartition(input || {})
        if (!partition) return success(false)

        if (protectedPartitions.has(partition)) {
          Logger.warn(
            `[systemHandlers] Skipping CLEAR_AI_MODEL_DATA for protected partition "${partition}" — active sessions are using it`
          )
          return success(false)
        }

        const userDataPath = app.getPath('userData')
        const pSession = session.fromPartition(partition)

        await pSession.clearCache()
        await pSession.clearStorageData({ storages: [...MODEL_STORAGE_TYPES] })
        await clearSafeCacheDirectories(userDataPath, new Set([partition]))
        invalidateCacheInfo()

        return success(true)
      } catch (error) {
        Logger.error('[IPC] Failed to clear model data:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.CACHE_INFO,
    async () => {
      try {
        const cached = getCachedCacheInfo()
        if (cached) {
          // Enrich cached with live autoClean config if possible
          try {
            const { getAutoCleanConfig } = await import('../cacheScheduler.js')
            const cfg = getAutoCleanConfig()
            if (cached.smart) {
              cached.smart.autoClean = {
                enabled: cfg.enabled,
                lastAutoCleanAt: cfg.lastAutoCleanAt
              }
            }
          } catch {}
          return success(cached)
        }

        const now = Date.now()
        const info = await getCacheInfo()
        // Enrich with scheduler config
        try {
          const { getAutoCleanConfig } = await import('../cacheScheduler.js')
          const cfg = getAutoCleanConfig()
          if (info.smart) {
            info.smart.autoClean = { enabled: cfg.enabled, lastAutoCleanAt: cfg.lastAutoCleanAt }
          }
        } catch {}
        setCachedCacheInfo(info, now)
        return success(info)
      } catch (error) {
        Logger.error('[IPC] Failed to get cache info:', error)
        return success(EMPTY_CACHE_INFO)
      }
    },
    requireTrustedIpcSender,
    success(EMPTY_CACHE_INFO)
  )

  registerIpcHandler(
    IPC_CHANNELS.SET_CACHE_AUTO_CLEAN,
    async (_event, enabled: unknown) => {
      try {
        const isEnabled = Boolean(enabled)
        const { setAutoCleanEnabled } = await import('../cacheScheduler.js')
        setAutoCleanEnabled(isEnabled)
        invalidateCacheInfo()
        return success(true)
      } catch (error) {
        Logger.error('[IPC] Failed to set auto clean:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.SMART_CACHE_ACTION,
    async (_event, action: unknown) => {
      try {
        const userDataPath = app.getPath('userData')
        if (action === 'clean_cold') {
          // Soğuk partition'ları temizle
          const { getAllPartitionActivities, getActivityCategory } =
            await import('../cacheRegistry.js')
          const activities = getAllPartitionActivities()
          const coldPartitions = Object.entries(activities)
            .filter(([, v]) => v.category === 'cold')
            .map(([k]) => `persist:${k}`)
            .filter((p) => !protectedPartitions.has(p))

          // Fallback: smart recommendation'dan al
          let targets = coldPartitions
          if (targets.length === 0) {
            const info = await getCacheInfo()
            targets = (info.smart?.recommendation.targetPartitions ?? []).map((k) =>
              k.startsWith('persist:') ? k : `persist:${k}`
            )
          }

          if (targets.length === 0) {
            // Hiç soğuk yoksa warning seviyesinde en az bir partition temizle
            const info = await getCacheInfo()
            const sorted = info.smart?.partitionDetails
              ?.filter((d) => d.category !== 'active')
              .sort((a, b) => b.size - a.size)
              .slice(0, 2)
              .map((d) => `persist:${d.key}`)
            targets = sorted ?? []
          }

          for (const partition of targets) {
            if (protectedPartitions.has(partition)) continue
            const pSession = session.fromPartition(partition)
            await pSession.clearCache()
            await pSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] })
          }
          await clearSafeCacheDirectories(userDataPath, new Set(targets))
          // Ek: süresi dolmuş soğuk dosyaları da temizle
          const { runIdleCleanup } = await import('../cacheCleanup/index.js')
          await runIdleCleanup()
          invalidateCacheInfo()
          Logger.info(`[SmartCache] clean_cold executed for ${targets.join(', ')}`)
          return success(true)
        }

        if (action === 'clean_all') {
          const allPartitions = getAllPartitions()
          const filtered = [...allPartitions].filter((p) => !protectedPartitions.has(p))
          for (const partition of filtered) {
            const pSession = session.fromPartition(partition)
            await pSession.clearCache()
            await pSession.clearStorageData({ storages: [...MODEL_STORAGE_TYPES] })
          }
          await clearSafeCacheDirectories(userDataPath, new Set(filtered))
          const { runManualCleanup } = await import('../cacheCleanup/index.js')
          await runManualCleanup()
          invalidateCacheInfo()
          Logger.info('[SmartCache] clean_all executed')
          return success(true)
        }

        return success(false)
      } catch (error) {
        Logger.error('[IPC] Smart cache action failed:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.DEEP_CLEAN_CACHE,
    async () => {
      try {
        const userDataPath = app.getPath('userData')

        await session.defaultSession.clearCache()

        const allPartitions = getAllPartitions()

        const filtered = [...allPartitions].filter((partition) => {
          if (protectedPartitions.has(partition)) {
            Logger.warn(
              `[systemHandlers] Skipping DEEP_CLEAN_CACHE for protected partition "${partition}" — active sessions are using it`
            )
            return false
          }
          return true
        })

        const clearPromises = filtered.map(async (partition) => {
          const pSession = session.fromPartition(partition)
          await pSession.clearCache()
          await pSession.clearStorageData({ storages: [...MODEL_STORAGE_TYPES] })
        })

        await Promise.all(clearPromises)
        await clearSafeCacheDirectories(userDataPath, new Set(filtered))
        await runManualCleanup()
        invalidateCacheInfo()

        return success(true)
      } catch (error) {
        Logger.error('[IPC] Failed to deep clean cache:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  // Logger forwarding from renderer (trusted-sender only)
  ipcMain.on(
    IPC_CHANNELS.LOGGER_LOG,
    (event, payload: { level: string; message: string; timestamp?: string }) => {
      if (!requireTrustedIpcSender(event)) return
      pushToLoggerBuffer(
        payload.level as 'trace' | 'debug' | 'info' | 'warn' | 'error',
        payload.message,
        payload.timestamp
      )
    }
  )

  const lastClipboardWriteBySender = new Map<number, { time: number; text: string }>()
  const CLIPBOARD_THROTTLE_MS = 500
  const CLIPBOARD_MAX_LENGTH = 100 * 1024

  registerIpcHandler(
    IPC_CHANNELS.COPY_TEXT,
    (event, text: string) => {
      try {
        if (typeof text !== 'string' || text.length === 0) return success(false)

        if (text.length > CLIPBOARD_MAX_LENGTH) {
          Logger.warn(`[Clipboard] Rejected oversized clipboard write: ${text.length} bytes`)
          return success(false)
        }

        const senderId = (event.sender as unknown as { id?: number })?.id ?? 0
        const now = Date.now()
        const last = lastClipboardWriteBySender.get(senderId)
        // Sadece aynı metin 500ms içinde tekrar kopyalanırsa throttle et;
        // farklı metinlerin hızlı kopyalanması (legit kullanıcı davranışı) engellenmemeli.
        if (last && now - last.time < CLIPBOARD_THROTTLE_MS && last.text === text) {
          Logger.warn('[Clipboard] Throttled rapid duplicate clipboard write')
          return success(false)
        }
        lastClipboardWriteBySender.set(senderId, { time: now, text })

        const sanitized = sanitizeClipboardText(text)

        clipboard.writeText(sanitized)
        Logger.info(`[Clipboard] Text copied: ${text.length} chars`)
        return success(true)
      } catch (error) {
        Logger.error('[Clipboard] Text copy failed:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )
}
