import { ipcMain } from 'electron'
import { APP_CONFIG } from '../../main/constants'
import { getCustomPlatformsPath } from '../../core/helpers'
import { ConfigManager } from '../../core/ConfigManager'
import type { AiPlatform } from '@shared/types'
import {
    AI_REGISTRY,
    DEFAULT_AI_ID,
    isAuthDomain,
    CHROME_USER_AGENT,
    INACTIVE_PLATFORMS
} from './aiManager'

type CustomPlatformsMap = Record<string, AiPlatform>
export type AddCustomAiInput = { name: string; url: string; isSite?: boolean }
const MAX_CUSTOM_AI_NAME = 80
const MAX_CUSTOM_AI_URL = 2048

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
            const name = normalizeCustomAiName(platformData?.name)
            const normalizedUrl = normalizeCustomAiUrl(platformData?.url)
            if (!name || !normalizedUrl) {
                return { success: false, error: 'Invalid custom AI input' }
            }

            const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

            let newPlatform: AiPlatform = {
                id,
                name,
                displayName: name,
                url: normalizedUrl,
                icon: platformData.isSite ? 'globe' : 'globe', // Keep globe or customize later
                selectors: { input: null, button: null, waitFor: null },
                isCustom: true,
                isSite: Boolean(platformData.isSite),
                color: undefined as string | undefined
            }

            // Restore icon from inactive platforms if available
            const lowerUrl = normalizedUrl.toLowerCase()
            for (const key in INACTIVE_PLATFORMS) {
                const p = INACTIVE_PLATFORMS[key]
                if (p.url && (lowerUrl.includes(p.url.replace('https://', '').replace(/\/$/, '')) || p.url.includes(lowerUrl))) {
                    newPlatform.icon = p.icon
                    newPlatform.color = p.color
                    break
                }
            }

            await manager.setItem(id, newPlatform)
            return { success: true, id, platform: newPlatform }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error('[IPC] Failed to add custom AI:', message)
            return { success: false, error: message }
        }
    })

    ipcMain.handle(IPC_CHANNELS.DELETE_CUSTOM_AI, async (event, id: string) => {
        if (typeof id !== 'string' || !id.startsWith('custom_') || id.length > 128) {
            return false
        }
        return manager.deleteItem(id)
    })

    ipcMain.handle(IPC_CHANNELS.GET_AI_REGISTRY, async (event, forceRefresh: boolean = false) => {
        const customPlatforms = await manager.read(forceRefresh)

        const mergedRegistry: Record<string, AiPlatform> = { ...AI_REGISTRY, ...customPlatforms }
        const allIds = [...Object.keys(AI_REGISTRY), ...Object.keys(customPlatforms)]

        return {
            aiRegistry: mergedRegistry,
            defaultAiId: DEFAULT_AI_ID,
            allAiIds: allIds,
            chromeUserAgent: CHROME_USER_AGENT
        }
    })

    ipcMain.handle(IPC_CHANNELS.IS_AUTH_DOMAIN, (event, urlOrHostname: string) => {
        try {
            const parsed = new URL(urlOrHostname)
            return isAuthDomain(parsed.hostname)
        } catch {
            return isAuthDomain(urlOrHostname)
        }
    })
}
