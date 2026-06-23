import type { DisplayMediaRequestHandlerHandlerRequest, Streams } from 'electron'
import { BrowserWindow, desktopCapturer, session } from 'electron'

import { markPartitionActive } from '../../core/cacheRegistry'
import { Logger } from '../../core/logger'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from '../../features/ai/aiManager'
import { APP_CONFIG } from '../constants'
import { showDisplayMediaPicker } from '../displayMediaPicker'

const ALLOWED_DEFAULT_PERMISSIONS = new Set(['notifications', 'media'])
const ALLOWED_AI_PERMISSIONS = new Set(['notifications', 'media', 'geolocation', 'display-capture'])

export type MainWindowResolver = () => BrowserWindow | null

/**
 * Embedded webviews (AI Studio, etc.) need the main process to resolve getDisplayMedia via
 * desktopCapturer; granting the session "display-capture" permission alone is not enough.
 */
async function handleDisplayMediaRequest(
  request: DisplayMediaRequestHandlerHandlerRequest,
  callback: (streams: Streams) => void,
  getMainWindow: MainWindowResolver
): Promise<void> {
  if (!request.videoRequested) {
    callback({})
    return
  }

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 150, height: 150 }
    })
    if (sources.length === 0) {
      callback({})
      return
    }

    let picked: (typeof sources)[0]
    if (sources.length === 1) {
      picked = sources[0]
    } else {
      const parent = BrowserWindow.getFocusedWindow() ?? getMainWindow()
      const pickedIndex = await showDisplayMediaPicker(parent, sources)
      if (pickedIndex === null || pickedIndex < 0 || pickedIndex >= sources.length) {
        callback({})
        return
      }
      picked = sources[pickedIndex]
    }

    callback({
      video: { id: picked.id, name: picked.name }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    Logger.error('[Sessions] Display media request handler error:', message)
    callback({})
  }
}

let sessionsConfigured = false

export function setupSessions(getMainWindow: MainWindowResolver) {
  if (sessionsConfigured) return

  try {
    const defaultSession = session.defaultSession
    if (defaultSession) {
      defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(ALLOWED_DEFAULT_PERMISSIONS.has(permission))
      })
      defaultSession.setPermissionCheckHandler((_webContents, permission) =>
        ALLOWED_DEFAULT_PERMISSIONS.has(permission)
      )
    }

    const aiPartitions = new Set<string>()
    if (APP_CONFIG.PARTITIONS.AI) aiPartitions.add(APP_CONFIG.PARTITIONS.AI)
    for (const p of Object.values(AI_REGISTRY)) p.partition && aiPartitions.add(p.partition)

    for (const p of Object.values(INACTIVE_PLATFORMS)) p.partition && aiPartitions.add(p.partition)

    for (const partition of aiPartitions) {
      const aiSession = session.fromPartition(partition)

      // Partition aktivite takibi: kurulum anında aktif işaretle
      const partitionKey = partition.replace('persist:', '')
      markPartitionActive(partitionKey)

      aiSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = APP_CONFIG.CHROME_USER_AGENT
        callback({ requestHeaders: details.requestHeaders })
      })

      aiSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(ALLOWED_AI_PERMISSIONS.has(permission))
      })
      aiSession.setPermissionCheckHandler((_webContents, permission) =>
        ALLOWED_AI_PERMISSIONS.has(permission as string)
      )

      aiSession.setDisplayMediaRequestHandler((request, callback) => {
        void handleDisplayMediaRequest(request, callback, getMainWindow)
      })
    }

    sessionsConfigured = true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    Logger.error(`[Sessions] Error:`, message)
  }
}
