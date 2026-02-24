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

export function registerAiRegistryHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG
    const manager = new ConfigManager<CustomPlatformsMap>(getCustomPlatformsPath())

    ipcMain.handle(IPC_CHANNELS.ADD_CUSTOM_AI, async (event, platformData: AddCustomAiInput) => {
        try {
            const id = 'custom_' + Date.now()
            // Normalize URL to prevent ERR_FILE_NOT_FOUND when user types "google.com" without protocol
            let normalizedUrl = platformData.url.trim()
            if (!/^https?:\/\//i.test(normalizedUrl)) {
                normalizedUrl = `https://${normalizedUrl}`
            }

            let newPlatform: AiPlatform = {
                id,
                name: platformData.name,
                displayName: platformData.name,
                url: normalizedUrl,
                icon: platformData.isSite ? 'globe' : 'globe', // Keep globe or customize later
                selectors: { input: null, button: null, waitFor: null },
                isCustom: true,
                isSite: platformData.isSite,
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
