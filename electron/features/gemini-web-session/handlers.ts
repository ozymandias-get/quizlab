import { ipcMain } from 'electron'
import { APP_CONFIG } from '../../app/constants'
import { geminiWebSessionManager } from './sessionManager'

let handlersRegistered = false

export function registerGeminiWebSessionHandlers(): void {
    if (handlersRegistered) return
    handlersRegistered = true

    const { IPC_CHANNELS } = APP_CONFIG

    void geminiWebSessionManager.initialize().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[GeminiWebSession] Initialization failed:', message)
    })

    ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_STATUS, async () => {
        return geminiWebSessionManager.getStatus()
    })

    ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_OPEN_LOGIN, async () => {
        return geminiWebSessionManager.openLogin()
    })

    ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_CHECK_NOW, async () => {
        return geminiWebSessionManager.checkNow()
    })

    ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_REAUTH, async () => {
        return geminiWebSessionManager.reauthenticate()
    })

    ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_RESET_PROFILE, async () => {
        return geminiWebSessionManager.resetProfile()
    })

    ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_SET_ENABLED, async (_event, enabled: boolean) => {
        return geminiWebSessionManager.setEnabled(Boolean(enabled))
    })
}
