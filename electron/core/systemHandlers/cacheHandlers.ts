/**
 * IPC surface for the app's cache: clearing, per-partition clearing, the usage
 * readout and the two smart-clean actions.
 *
 * These channels all answer the same question from six angles ("how much disk
 * does this app use and how do I get it back"), so they live together even
 * though each one runs a different sweep.
 */
import { app, session } from 'electron'

import { googleSlotForPartition } from '../../../shared/lib/googleSessionUrl.js'
import { success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { getCacheInfo, runManualCleanup } from '../cacheCleanup/index.js'
import { toStrictBoolean } from '../ipcPayloadGuards.js'
import { requireTrustedIpcSender } from '../ipcSecurity.js'
import { Logger } from '../logger.js'
import {
  clearSafeCacheDirectories,
  getCachedCacheInfo,
  getStoredPartitions,
  invalidateCacheInfo,
  isProtectedPartition,
  MODEL_STORAGE_TYPES,
  resolveAiModelPartition,
  resolveCacheOnlyPartition,
  setCachedCacheInfo
} from './cache.js'

const { IPC_CHANNELS } = APP_CONFIG

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

function logProtectedPartitionSkip(channel: string, partition: string): void {
  Logger.warn(
    `[systemHandlers] Skipping ${channel} for protected partition "${partition}" — active sessions are using it`
  )
}

export function registerCacheHandlers(): void {
  registerIpcHandler(
    IPC_CHANNELS.CLEAR_CACHE,
    async () => {
      try {
        const userDataPath = app.getPath('userData')

        await session.defaultSession.clearCache()

        const allPartitions = await getStoredPartitions(userDataPath)

        const filtered = [...allPartitions].filter((partition) => {
          if (isProtectedPartition(partition)) {
            logProtectedPartitionSkip('CLEAR_CACHE', partition)
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
        invalidateCacheInfo()
        Logger.error('[IPC] Failed to clear cache:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.CLEAR_AI_MODEL_DATA,
    async (_event, input: { id?: unknown; partition?: unknown; cacheOnly?: unknown }) => {
      try {
        const cacheOnly = input?.cacheOnly === true
        const partition = cacheOnly
          ? resolveCacheOnlyPartition(input.partition)
          : resolveAiModelPartition(input || {})
        if (!partition) return success(false)

        if (isProtectedPartition(partition)) {
          logProtectedPartitionSkip('CLEAR_AI_MODEL_DATA', partition)
          return success(false)
        }

        const userDataPath = app.getPath('userData')
        const targetPartitions = new Set<string>([partition])
        if (!cacheOnly && googleSlotForPartition(partition) !== null) {
          const stored = await getStoredPartitions(userDataPath)
          for (const storedPartition of stored) {
            if (googleSlotForPartition(storedPartition) !== null) {
              if (isProtectedPartition(storedPartition)) {
                logProtectedPartitionSkip('CLEAR_AI_MODEL_DATA', storedPartition)
                return success(false)
              }
              targetPartitions.add(storedPartition)
            }
          }
        }

        for (const targetPartition of targetPartitions) {
          const pSession = session.fromPartition(targetPartition)
          await pSession.clearCache()
          await pSession.clearStorageData({
            storages: cacheOnly ? ['serviceworkers', 'cachestorage'] : [...MODEL_STORAGE_TYPES]
          })
        }
        await clearSafeCacheDirectories(userDataPath, targetPartitions, false)
        invalidateCacheInfo()

        return success(true)
      } catch (error) {
        invalidateCacheInfo()
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
        // `Boolean("false")` is true: a non-boolean payload must be rejected,
        // not coerced into the opposite of what the caller asked for.
        if (typeof enabled !== 'boolean') {
          Logger.warn('[IPC] setCacheAutoClean rejected a non-boolean payload')
          return success(false)
        }
        const { setAutoCleanEnabled } = await import('../cacheScheduler.js')
        setAutoCleanEnabled(toStrictBoolean(enabled))
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
          const { getActivityCategory } = await import('../cacheRegistry.js')
          const info = await getCacheInfo()
          const coldPartitions = Object.entries(info.breakdown.partitionCaches)
            .filter(([key, size]) => size > 0 && getActivityCategory(key) === 'cold')
            .map(([key]) => `persist:${key}`)
            .filter((p) => !isProtectedPartition(p))

          const targetsToClean = coldPartitions
          for (const partition of targetsToClean) {
            const pSession = session.fromPartition(partition)
            await pSession.clearCache()
            await pSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] })
          }
          await clearSafeCacheDirectories(userDataPath, new Set(targetsToClean))
          // Ek: süresi dolmuş soğuk dosyaları da temizle
          const { runIdleCleanup } = await import('../cacheCleanup/index.js')
          const cleanup = await runIdleCleanup()
          if (cleanup.errors > 0) throw new Error('Idle cache cleanup was incomplete')
          invalidateCacheInfo()
          Logger.info(`[SmartCache] clean_cold executed for ${targetsToClean.join(', ')}`)
          return success(true)
        }

        if (action === 'clean_all') {
          const allPartitions = await getStoredPartitions(userDataPath)
          const filtered = [...allPartitions].filter((p) => !isProtectedPartition(p))
          for (const partition of filtered) {
            const pSession = session.fromPartition(partition)
            await pSession.clearCache()
            await pSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] })
          }
          await clearSafeCacheDirectories(userDataPath, new Set(filtered))
          const { runManualCleanup } = await import('../cacheCleanup/index.js')
          const cleanup = await runManualCleanup()
          if (cleanup.errors > 0) throw new Error('Manual cache cleanup was incomplete')
          invalidateCacheInfo()
          Logger.info('[SmartCache] clean_all executed')
          return success(true)
        }

        return success(false)
      } catch (error) {
        invalidateCacheInfo()
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

        const allPartitions = await getStoredPartitions(userDataPath)

        const filtered = [...allPartitions].filter((partition) => {
          if (isProtectedPartition(partition)) {
            logProtectedPartitionSkip('DEEP_CLEAN_CACHE', partition)
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
        const cleanup = await runManualCleanup()
        if (cleanup.errors > 0) throw new Error('Manual cache cleanup was incomplete')
        invalidateCacheInfo()

        return success(true)
      } catch (error) {
        invalidateCacheInfo()
        Logger.error('[IPC] Failed to deep clean cache:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )
}
