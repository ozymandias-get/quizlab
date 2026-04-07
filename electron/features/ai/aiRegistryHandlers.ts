import { ipcMain } from 'electron'
import crypto from 'crypto'
import { APP_CONFIG } from '../../app/constants'
import { requireTrustedIpcSender } from '../../core/ipcSecurity'
import { getCustomPlatformsPath } from '../../core/helpers'
import { ConfigManager } from '../../core/ConfigManager'
import type { AiPlatform, CustomAiResult } from '@shared-core/types'
import { geminiWebSessionManager } from '../gemini-web-session/sessionManager'
import {
  AI_REGISTRY,
  DEFAULT_AI_ID,
  isAuthDomain,
  CHROME_USER_AGENT,
  INACTIVE_PLATFORMS
} from './aiManager'
import { GOOGLE_WEB_SESSION_REGISTRY_IDS } from '../../../shared/constants/google-ai-web-apps'

type CustomPlatformsMap = Record<string, AiPlatform>
export type AddCustomAiInput = { name: string; url: string; isSite?: boolean }
const MAX_CUSTOM_AI_NAME = 80
const MAX_CUSTOM_AI_URL = 2048

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

export function registerAiRegistryHandlers() {
  const { IPC_CHANNELS } = APP_CONFIG
  const manager = new ConfigManager<CustomPlatformsMap>(getCustomPlatformsPath())

  ipcMain.handle(IPC_CHANNELS.ADD_CUSTOM_AI, async (event, platformData: AddCustomAiInput) => {
    try {
      if (!requireTrustedIpcSender(event)) return makeInvalidInput('Untrusted sender')
      const name = normalizeCustomAiName(platformData?.name)
      const normalizedUrl = normalizeCustomAiUrl(platformData?.url)
      if (!name || !normalizedUrl) {
        return makeInvalidInput('Invalid custom AI input')
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
        color: undefined as string | undefined
      }

      const lowerUrl = normalizedUrl.toLowerCase()
      for (const key in INACTIVE_PLATFORMS) {
        const p = INACTIVE_PLATFORMS[key]
        if (
          p.url &&
          (lowerUrl.includes(p.url.replace('https://', '').replace(/\/$/, '')) ||
            p.url.includes(lowerUrl))
        ) {
          newPlatform.icon = p.icon
          newPlatform.color = p.color
          break
        }
      }

      await manager.setItem(id, newPlatform)
      return {
        ok: true,
        data: {
          id,
          platform: newPlatform
        }
      } satisfies CustomAiResult
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[IPC] Failed to add custom AI:', message)
      return makeInternalError(message)
    }
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_CUSTOM_AI, async (event, id: string) => {
    if (!requireTrustedIpcSender(event)) return false
    if (typeof id !== 'string' || !id.startsWith('custom_') || id.length > 128) {
      return false
    }
    return manager.deleteItem(id)
  })

  ipcMain.handle(IPC_CHANNELS.GET_AI_REGISTRY, async (event, forceRefresh: boolean = false) => {
    if (!requireTrustedIpcSender(event)) return null
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
      console.warn('[IPC] Failed to resolve gemini session status for AI registry:', error)
      for (const appId of GOOGLE_WEB_SESSION_REGISTRY_IDS) {
        delete mergedRegistry[appId]
      }
    }

    const allIds = Object.keys(mergedRegistry)

    return {
      aiRegistry: mergedRegistry,
      defaultAiId: DEFAULT_AI_ID,
      allAiIds: allIds,
      chromeUserAgent: CHROME_USER_AGENT
    }
  })

  ipcMain.handle(IPC_CHANNELS.IS_AUTH_DOMAIN, (event, urlOrHostname: string) => {
    if (!requireTrustedIpcSender(event)) return false
    try {
      const parsed = new URL(urlOrHostname)
      return isAuthDomain(parsed.hostname)
    } catch {
      return isAuthDomain(urlOrHostname)
    }
  })
}
