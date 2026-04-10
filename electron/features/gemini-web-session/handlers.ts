import { ipcMain } from 'electron'
import { APP_CONFIG } from '../../app/constants'
import { toStrictBoolean } from '../../core/ipcPayloadGuards'
import { requireTrustedIpcSender } from '../../core/ipcSecurity'
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

  ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_STATUS, async (event) => {
    if (!requireTrustedIpcSender(event)) return null
    return geminiWebSessionManager.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_OPEN_LOGIN, async (event) => {
    if (!requireTrustedIpcSender(event)) return false
    return geminiWebSessionManager.openLogin()
  })

  ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_CHECK_NOW, async (event) => {
    if (!requireTrustedIpcSender(event)) return false
    return geminiWebSessionManager.checkNow()
  })

  ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_REAUTH, async (event) => {
    if (!requireTrustedIpcSender(event)) return false
    return geminiWebSessionManager.reauthenticate()
  })

  ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_RESET_PROFILE, async (event) => {
    if (!requireTrustedIpcSender(event)) return false
    return geminiWebSessionManager.resetProfile()
  })

  ipcMain.handle(IPC_CHANNELS.GEMINI_WEB_SET_ENABLED, async (event, enabled: unknown) => {
    if (!requireTrustedIpcSender(event)) return false
    return geminiWebSessionManager.setEnabled(toStrictBoolean(enabled))
  })

  ipcMain.handle(
    IPC_CHANNELS.GEMINI_WEB_SET_ENABLED_APPS,
    async (event, enabledAppIds: string[]) => {
      if (!requireTrustedIpcSender(event)) return false
      return geminiWebSessionManager.setEnabledApps(
        Array.isArray(enabledAppIds) ? enabledAppIds : []
      )
    }
  )
}

export async function shutdownGeminiWebSessionHandlers(): Promise<void> {
  await geminiWebSessionManager.dispose()
}
