import { ipcMain } from 'electron'
import { APP_CONFIG } from '../../app/constants'
import { getAiConfigPath } from '../../core/helpers'
import { ConfigManager } from '../../core/ConfigManager'
import type { AiSelectorConfig } from '@shared-core/types'

type StoredAiConfig = AiSelectorConfig & { timestamp?: number }
type AiConfigMap = Record<string, StoredAiConfig>
const MAX_SELECTOR_LENGTH = 2000
const MAX_SUBMIT_MODE_LENGTH = 64

const HOSTNAME_REGEX = /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*$/i

const normalizeHostname = (hostname: unknown): string | null => {
    if (typeof hostname !== 'string') return null
    const normalized = hostname.trim().toLowerCase()
    if (!normalized || normalized.includes('/') || !HOSTNAME_REGEX.test(normalized)) {
        return null
    }
    return normalized
}

const sanitizeSelector = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined
    if (value === null) return null
    if (typeof value !== 'string' || value.length > MAX_SELECTOR_LENGTH) return undefined
    return value
}

const sanitizeConfig = (config: unknown): AiSelectorConfig | null => {
    if (!config || typeof config !== 'object') return null
    const raw = config as AiSelectorConfig

    const input = sanitizeSelector(raw.input)
    const button = sanitizeSelector(raw.button)
    const waitFor = sanitizeSelector(raw.waitFor)

    if ((raw.input !== undefined && input === undefined) ||
        (raw.button !== undefined && button === undefined) ||
        (raw.waitFor !== undefined && waitFor === undefined)) {
        return null
    }

    let submitMode: AiSelectorConfig['submitMode'] | undefined
    if (raw.submitMode !== undefined) {
        if (typeof raw.submitMode !== 'string' || raw.submitMode.length > MAX_SUBMIT_MODE_LENGTH) {
            return null
        }
        submitMode = raw.submitMode
    }

    return { input, button, waitFor, submitMode }
}

export function registerAiConfigHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG
    const manager = new ConfigManager<AiConfigMap>(getAiConfigPath())

    ipcMain.handle(IPC_CHANNELS.SAVE_AI_CONFIG, async (_event, hostname: string, config: AiSelectorConfig) => {
        const normalizedHostname = normalizeHostname(hostname)
        const sanitizedConfig = sanitizeConfig(config)
        if (!normalizedHostname || !sanitizedConfig) return false
        return manager.setItem(normalizedHostname, { ...sanitizedConfig, timestamp: Date.now() })
    })

    ipcMain.handle(IPC_CHANNELS.GET_AI_CONFIG, async (_event, hostname?: string) => {
        const config = await manager.read()
        if (!hostname) return config
        const normalizedHostname = normalizeHostname(hostname)
        if (!normalizedHostname) return null
        return config[normalizedHostname] || null
    })

    ipcMain.handle(IPC_CHANNELS.DELETE_AI_CONFIG, async (_event, hostname: string) => {
        const normalizedHostname = normalizeHostname(hostname)
        if (!normalizedHostname) return false
        return manager.deleteItem(normalizedHostname)
    })
}

