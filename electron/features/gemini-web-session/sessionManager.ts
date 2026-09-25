import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionConfig,
  GeminiWebSessionRefreshEvent,
  GeminiWebSessionStatus
} from '@shared-core/types'

import { APP_CONFIG } from '../../app/constants.js'
import { getMainWindow } from '../../app/windowManager.js'
import { PROFILE_PARTITION } from './sessionConfig.js'
import {
  createGeminiSessionConfig,
  createGeminiSessionPaths,
  resolvePersistentSession
} from './sessionContext.js'
import type { SessionImportResult } from './sessionContracts.js'
import { SessionOrchestrator } from './sessionOrchestrator.js'

class GeminiWebSessionManager {
  private orchestrator: SessionOrchestrator | null = null

  private getOrchestrator(): SessionOrchestrator {
    if (this.orchestrator) return this.orchestrator

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
    return this.orchestrator
  }

  getConfig(): GeminiWebSessionConfig {
    return this.getOrchestrator().getConfig()
  }

  async initialize(): Promise<void> {
    return this.getOrchestrator().initialize()
  }

  async getStatus(): Promise<GeminiWebSessionStatus> {
    return this.getOrchestrator().getStatus()
  }

  async setEnabled(enabled: unknown): Promise<GeminiWebSessionActionResult> {
    return this.getOrchestrator().setEnabled(enabled)
  }

  async setEnabledApps(enabledAppIds: string[]): Promise<GeminiWebSessionActionResult> {
    return this.getOrchestrator().setEnabledApps(enabledAppIds)
  }

  async exportSession(filePath: string): Promise<{ success: boolean; error?: string }> {
    return this.getOrchestrator().exportSession(filePath)
  }

  async importSession(filePath: string): Promise<SessionImportResult> {
    return this.getOrchestrator().importSession(filePath)
  }

  async resetProfile(): Promise<GeminiWebSessionActionResult> {
    return this.getOrchestrator().resetProfile()
  }

  async ensureAuthenticated(): Promise<{
    ok: boolean
    error?: string
    status: GeminiWebSessionStatus
  }> {
    return this.getOrchestrator().ensureAuthenticated()
  }

  async dispose(): Promise<void> {
    return this.getOrchestrator().dispose()
  }
}

export const geminiWebSessionManager = new GeminiWebSessionManager()
