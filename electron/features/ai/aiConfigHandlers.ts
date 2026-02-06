import { ipcMain } from 'electron'
import { APP_CONFIG } from '../../main/constants'
import { getAiConfigPath } from '../../core/helpers'
import { ConfigManager } from '../../core/ConfigManager'
import type { AiSelectorConfig } from '@shared/types'

type StoredAiConfig = AiSelectorConfig & { timestamp?: number }
type AiConfigMap = Record<string, StoredAiConfig>

export function registerAiConfigHandlers() {
    const { IPC_CHANNELS } = APP_CONFIG
    const manager = new ConfigManager<AiConfigMap>(getAiConfigPath())

    ipcMain.handle(IPC_CHANNELS.SAVE_AI_CONFIG, async (event, hostname: string, config: AiSelectorConfig) => {
        return manager.setItem(hostname, { ...config, timestamp: Date.now() })
    })

    ipcMain.handle(IPC_CHANNELS.GET_AI_CONFIG, async (event, hostname?: string) => {
        const config = await manager.read()
        return hostname ? config[hostname] : config
    })

    ipcMain.handle(IPC_CHANNELS.DELETE_AI_CONFIG, async (event, hostname: string) => {
        return manager.deleteItem(hostname)
    })

    ipcMain.handle(IPC_CHANNELS.DELETE_ALL_AI_CONFIGS, async () => {
        return manager.clear()
    })
}
