import type { AiPlatform, CustomAiResult } from '@shared-core/types'

import crypto from 'crypto'
import { app, session as electronSession } from 'electron'
import fs from 'fs'
import path from 'path'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import {
  registerCustomPlatformOrigin,
  unregisterAccountPartition,
  unregisterCustomPlatformOrigin
} from '../../app/window/permissionPolicy.js'
import { setupAiSession } from '../../app/window/sessions.js'
import { unregisterDynamicPartition } from '../../core/cacheRegistry.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { Logger } from '../../core/logger.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'
import { buildAccountRows } from '../web-session/siteSessionAccounts.js'
import { getSiteSessionConfig } from '../web-session/siteSessionConfig.js'
import { withSiteSessionLock } from '../web-session/siteSessionLock.js'
import { removePartitionDirectory } from '../web-session/siteSessionPartitions.js'
import { clearPendingSiteSession } from '../web-session/siteSessionPendingSessions.js'
import { buildSiteSessionTargets } from '../web-session/siteSessionTargets.js'
import { wipeSiteSession } from '../web-session/siteSessionWipe.js'
import { AI_REGISTRY, CHROME_USER_AGENT, DEFAULT_AI_ID, INACTIVE_PLATFORMS } from './aiManager.js'
import { getCustomPlatformStore } from './customPlatformStore.js'

type AddCustomAiInput = { name: string; url: string; isSite?: boolean }
const MAX_CUSTOM_AI_NAME = 80
const MAX_CUSTOM_AI_URL = 2048

/**
 * UUID v4 regex — matches only the standard format: custom_<UUID>
 * This implicitly rejects any path traversal characters (.., /, \)
 * and any other non-conforming values.
 */
const CUSTOM_AI_ID_REGEX =
  /^custom_[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i

const normalizeCustomAiName = (name: unknown): string | null => {
  if (typeof name !== 'string') return null
  const normalized = name.trim()
  if (!normalized || normalized.length > MAX_CUSTOM_AI_NAME) return null
  return normalized
}

export const normalizeCustomAiUrl = (url: unknown): string | null => {
  if (typeof url !== 'string') return null

  let normalized = url.trim()
  if (!normalized || normalized.length > MAX_CUSTOM_AI_URL) return null
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`
  }

  try {
    const parsed = new URL(normalized)
    if (!parsed.hostname || parsed.username || parsed.password) return null
    if (parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

let handlersRegistered = false

/**
 * The session and the stored state of a site the user deleted.
 *
 * Every account of the site is wiped under its own lock — the same lock an
 * import into that account runs under — so an import that is already on its
 * way writes its cookies before the wipe and not after it. After the wipe an
 * additional account's partition is taken out of the permission policy and
 * the cache registry, so the running process no longer trusts a partition it
 * just deleted, and its folder is removed from disk. The primary account
 * keeps the platform's partition: that partition is the site's own and is not
 * removed here.
 *
 * None of it may keep the site from being deleted: a failure is logged and
 * the delete goes on.
 */
async function clearDeletedSiteSession(siteId: string): Promise<void> {
  /** The partitions of the additional accounts, once they are no longer trusted. */
  const extraPartitions: string[] = []

  try {
    // The targets have to be looked up before the platform is deleted: the
    // target list is derived from the registry, and the deleted site is no
    // longer in it afterwards.
    const [targets, state] = await Promise.all([
      buildSiteSessionTargets(),
      getSiteSessionConfig().read()
    ])
    const rows = buildAccountRows(targets, state).filter((row) => row.siteId === siteId)

    for (const row of rows) {
      try {
        await withSiteSessionLock(siteId, row.accountId, () =>
          wipeSiteSession(electronSession.fromPartition(row.partition), row)
        )
      } catch (error) {
        Logger.warn(`[AI] The session of "${row.accountId}" could not be cleared:`, error)
      }

      // The primary account lives in the platform's partition. It is wiped,
      // but it is not an account partition: there is nothing to unregister
      // and nothing to delete.
      if (row.isPrimary) continue

      unregisterAccountPartition(row.partition)
      unregisterDynamicPartition(row.partition)
      extraPartitions.push(row.partition)
    }
  } catch (error) {
    Logger.warn('[AI] The sessions of the deleted site could not be cleared:', error)
  }

  // A session that waits for an account would keep asking a question about a
  // site that no longer exists. It is cleared after the account locks, so an
  // import that was still running cannot hold it again.
  clearPendingSiteSession(siteId)

  try {
    await getSiteSessionConfig().forget(siteId)
  } catch (error) {
    Logger.warn('[AI] The session state of the deleted site could not be removed:', error)
  }

  for (const partition of extraPartitions) {
    try {
      await removePartitionDirectory(partition)
    } catch (error) {
      Logger.warn(
        `[AI] The data folder of the deleted account in "${partition}" could not be removed:`,
        error
      )
    }
  }
}

export function registerAiRegistryHandlers() {
  const { IPC_CHANNELS } = APP_CONFIG
  const manager = getCustomPlatformStore()

  // Guard: ipcMain will throw ERR_IPC_CHANNEL_ALREADY_REGISTERED if
  // registerGeneralHandlers() is ever called twice.
  if (handlersRegistered) return
  handlersRegistered = true

  registerIpcHandler(
    IPC_CHANNELS.ADD_CUSTOM_AI,
    async (_event, platformData: AddCustomAiInput) => {
      try {
        const name = normalizeCustomAiName(platformData?.name)
        const normalizedUrl = normalizeCustomAiUrl(platformData?.url)
        if (!name || !normalizedUrl) {
          return failure('invalid_input', 'Invalid custom AI input')
        }

        const id = `custom_${crypto.randomUUID()}`

        let newPlatform: AiPlatform = {
          id,
          name,
          displayName: name,
          url: normalizedUrl,
          icon: 'globe',
          selectors: { input: null, button: null, waitFor: null },
          isCustom: true,
          isSite: Boolean(platformData.isSite),
          partition: `persist:ai_custom_${id}`,
          color: undefined as string | undefined
        }

        const customHostname = new URL(normalizedUrl).hostname.toLowerCase()
        for (const key in INACTIVE_PLATFORMS) {
          const p = INACTIVE_PLATFORMS[key]
          if (!p.url) continue
          try {
            const platformHostname = new URL(p.url).hostname.toLowerCase()
            const isMatch =
              customHostname === platformHostname || customHostname.endsWith('.' + platformHostname)
            if (isMatch) {
              newPlatform.icon = p.icon
              newPlatform.color = p.color
              break
            }
          } catch {
            continue
          }
        }

        await manager.setItem(id, newPlatform)
        try {
          // Bind the partition to the origin the user actually chose. Without
          // this the permission policy has no trusted host for the platform
          // and would deny every permission; with it, passive capabilities
          // work while ambient ones stay default-denied.
          registerCustomPlatformOrigin(newPlatform.partition!, newPlatform.url)
          if (newPlatform.partition) setupAiSession(newPlatform.partition)
        } catch (error) {
          Logger.warn('[AI] Failed to configure custom session permissions:', error)
        }
        return success({
          ok: true,
          data: {
            id,
            platform: newPlatform
          }
        } satisfies CustomAiResult)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        Logger.error('[IPC] Failed to add custom AI:', message)
        return failure('internal_error', message)
      }
    },
    requireTrustedIpcSender,
    failure('invalid_input', 'Untrusted sender')
  )

  registerIpcHandler(
    IPC_CHANNELS.DELETE_CUSTOM_AI,
    async (_event, id: string) => {
      if (typeof id !== 'string' || !CUSTOM_AI_ID_REGEX.test(id)) {
        return success(false)
      }
      try {
        const siteId = `custom:${id}`

        // The session of a site the user deletes goes with it. Deleting the
        // partition directory on disk is not enough: the session Electron
        // already holds in memory would survive, and the site would still be
        // signed in the next time the app opened it.
        await clearDeletedSiteSession(siteId)

        const deleted = await manager.deleteItem(id)

        try {
          const partitionDir = path.join(app.getPath('userData'), 'Partitions', `ai_custom_${id}`)
          await fs.promises.rm(partitionDir, { recursive: true, force: true }).catch(() => {})
        } catch {}

        unregisterCustomPlatformOrigin(`persist:ai_custom_${id}`)

        return success(deleted)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        Logger.error('[IPC] Failed to delete custom AI:', message)
        return failure('internal_error', message)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.GET_AI_REGISTRY,
    async (_event, forceRefresh: boolean = false) => {
      try {
        const customPlatforms = await manager.read(forceRefresh)

        const mergedRegistry: Record<string, AiPlatform> = { ...AI_REGISTRY, ...customPlatforms }

        for (const platform of Object.values(customPlatforms)) {
          if (!platform.partition?.startsWith('persist:ai_custom_')) continue
          try {
            // Re-bind the saved origin on every registry read. This runs after
            // a restart, so without it a custom platform would have no trusted
            // host and the permission policy would deny it.
            registerCustomPlatformOrigin(platform.partition, platform.url)
            setupAiSession(platform.partition)
          } catch (error) {
            Logger.warn('[AI] Failed to configure custom session permissions:', error)
          }
        }

        const allIds = Object.keys(mergedRegistry)

        return success({
          aiRegistry: mergedRegistry,
          defaultAiId: DEFAULT_AI_ID,
          allAiIds: allIds,
          chromeUserAgent: CHROME_USER_AGENT
        })
      } catch (error) {
        Logger.error('[IPC] GET_AI_REGISTRY failed:', error)
        return failure('not_found', 'Registry not available')
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )
}
