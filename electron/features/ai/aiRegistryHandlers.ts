import type { AiPlatform, CustomAiResult } from '@shared-core/types'

import crypto from 'crypto'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'

import { GOOGLE_WEB_SESSION_REGISTRY_IDS } from '../../../shared/constants/google-ai-web-apps'
import { failure, success } from '../../../shared/lib/typedIpc'
import { registerIpcHandler } from '../../../shared/lib/typedIpcMain'
import { APP_CONFIG } from '../../app/constants'
import { ConfigManager } from '../../core/ConfigManager'
import { getCustomPlatformsPath } from '../../core/helpers'
import { requireTrustedIpcSender } from '../../core/ipcSecurity'
import { Logger } from '../../core/logger'
import { geminiWebSessionManager } from '../gemini-web-session/sessionManager'
import {
  AI_REGISTRY,
  CHROME_USER_AGENT,
  DEFAULT_AI_ID,
  INACTIVE_PLATFORMS,
  isAuthDomain
} from './aiManager'

type CustomPlatformsMap = Record<string, AiPlatform>
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

const makeInvalidInput = (message: string): CustomAiResult => ({
  ok: false,
  error: {
    code: 'invalid_input',
    message
  }
})

const makeInternalError = (message: string): CustomAiResult => ({
  ok: false,
  error: {
    code: 'internal_error',
    message
  }
})

const normalizeCustomAiName = (name: unknown): string | null => {
  if (typeof name !== 'string') return null
  const normalized = name.trim()
  if (!normalized || normalized.length > MAX_CUSTOM_AI_NAME) return null
  return normalized
}

const normalizeCustomAiUrl = (url: unknown): string | null => {
  if (typeof url !== 'string') return null

  let normalized = url.trim()
  if (!normalized || normalized.length > MAX_CUSTOM_AI_URL) return null
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`
  }

  try {
    const parsed = new URL(normalized)
    if (!parsed.hostname) return null
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

let handlersRegistered = false

export function registerAiRegistryHandlers() {
  const { IPC_CHANNELS } = APP_CONFIG
  const manager = new ConfigManager<CustomPlatformsMap>(getCustomPlatformsPath())

  // Guard: ipcMain will throw ERR_IPC_CHANNEL_ALREADY_REGISTERED if
  // registerGeneralHandlers() is ever called twice.
  if (handlersRegistered) return
  handlersRegistered = true

  registerIpcHandler(
    IPC_CHANNELS.ADD_CUSTOM_AI,
    async (event, platformData: AddCustomAiInput) => {
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
    async (event, id: string) => {
      if (typeof id !== 'string' || !CUSTOM_AI_ID_REGEX.test(id)) {
        return success(false)
      }
      const deleted = await manager.deleteItem(id)

      try {
        const partitionDir = path.join(app.getPath('userData'), 'Partitions', `ai_custom_${id}`)
        await fs.promises.rm(partitionDir, { recursive: true, force: true }).catch(() => {})
      } catch {}

      return success(deleted)
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.GET_AI_REGISTRY,
    async (event, forceRefresh: boolean = false) => {
      try {
        const customPlatforms = await manager.read(forceRefresh)

        const mergedRegistry: Record<string, AiPlatform> = { ...AI_REGISTRY, ...customPlatforms }

        try {
          const geminiStatus = await geminiWebSessionManager.getStatus()
          const isGoogleWebEnabled = geminiStatus.featureEnabled && geminiStatus.enabled
          const enabledAppIds = new Set(geminiStatus.enabledAppIds)

          for (const appId of GOOGLE_WEB_SESSION_REGISTRY_IDS) {
            if (!isGoogleWebEnabled || !enabledAppIds.has(appId)) {
              delete mergedRegistry[appId]
            }
          }
        } catch (error) {
          Logger.warn('[IPC] Failed to resolve gemini session status for AI registry:', error)
          for (const appId of GOOGLE_WEB_SESSION_REGISTRY_IDS) {
            delete mergedRegistry[appId]
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

  registerIpcHandler(
    IPC_CHANNELS.IS_AUTH_DOMAIN,
    (event, urlOrHostname: string) => {
      try {
        const parsed = new URL(urlOrHostname)
        return success(isAuthDomain(parsed.hostname))
      } catch {
        try {
          const parsed = new URL(`https://${urlOrHostname}`)
          return success(isAuthDomain(parsed.hostname))
        } catch {
          return success(false)
        }
      }
    },
    requireTrustedIpcSender,
    success(false)
  )
}
