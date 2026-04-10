import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionConfig,
  GeminiWebSessionRefreshEvent,
  GeminiWebSessionStatus
} from '@shared-core/types'
import { PROFILE_PARTITION } from './sessionConfig'
import {
  createGeminiSessionConfig,
  createGeminiSessionPaths,
  resolvePersistentSession
} from './sessionContext'
import { SessionOrchestrator } from './sessionOrchestrator'
import { getMainWindow } from '../../app/windowManager'
import { APP_CONFIG } from '../../app/constants'

export class GeminiWebSessionManager {
  private readonly orchestrator: SessionOrchestrator

  constructor() {
    const paths = createGeminiSessionPaths()
    const config: GeminiWebSessionConfig = createGeminiSessionConfig(paths.profileDir)
    this.orchestrator = new SessionOrchestrator({
      config,
      paths,
      resolvePersistentSession: () => resolvePersistentSession(PROFILE_PARTITION),
      emitRefreshEvent: (event: GeminiWebSessionRefreshEvent) => {
        const mainWindow = getMainWindow()
        if (
          !mainWindow ||
          (typeof mainWindow.isDestroyed === 'function' && mainWindow.isDestroyed())
        )
          return

        const channel =
          event.phase === 'started'
            ? APP_CONFIG.IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_STARTED
            : event.phase === 'success'
              ? APP_CONFIG.IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_SUCCESS
              : APP_CONFIG.IPC_CHANNELS.GEMINI_WEB_SESSION_REFRESH_FAILED

        mainWindow.webContents.send(channel, event)
      }
    })
  }

  getConfig(): GeminiWebSessionConfig {
    return this.orchestrator.getConfig()
  }

  async initialize(): Promise<void> {
    return this.orchestrator.initialize()
  }

  async getStatus(): Promise<GeminiWebSessionStatus> {
    return this.orchestrator.getStatus()
  }

  async setEnabled(enabled: unknown): Promise<GeminiWebSessionActionResult> {
    return this.orchestrator.setEnabled(enabled)
  }

  async setEnabledApps(enabledAppIds: string[]): Promise<GeminiWebSessionActionResult> {
    return this.orchestrator.setEnabledApps(enabledAppIds)
  }

  async openLogin(): Promise<GeminiWebSessionActionResult> {
    return this.orchestrator.openLogin()
  }

  async checkNow(): Promise<GeminiWebSessionActionResult> {
    return this.orchestrator.checkNow()
  }

  async reauthenticate(): Promise<GeminiWebSessionActionResult> {
    return this.orchestrator.reauthenticate()
  }

  async resetProfile(): Promise<GeminiWebSessionActionResult> {
    return this.orchestrator.resetProfile()
  }

  async ensureAuthenticated(): Promise<{
    ok: boolean
    error?: string
    status: GeminiWebSessionStatus
  }> {
    return this.orchestrator.ensureAuthenticated()
  }

  async dispose(): Promise<void> {
    return this.orchestrator.dispose()
  }
}

export const geminiWebSessionManager = new GeminiWebSessionManager()
