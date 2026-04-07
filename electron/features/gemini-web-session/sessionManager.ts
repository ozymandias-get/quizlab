import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionConfig,
  GeminiWebSessionStatus
} from '@shared-core/types'
import { PROFILE_PARTITION } from './sessionConfig'
import {
  createGeminiSessionConfig,
  createGeminiSessionPaths,
  resolvePersistentSession
} from './sessionContext'
import { SessionOrchestrator } from './sessionOrchestrator'

export class GeminiWebSessionManager {
  private readonly orchestrator: SessionOrchestrator

  constructor() {
    const paths = createGeminiSessionPaths()
    const config: GeminiWebSessionConfig = createGeminiSessionConfig(paths.profileDir)
    this.orchestrator = new SessionOrchestrator({
      config,
      paths,
      resolvePersistentSession: () => resolvePersistentSession(PROFILE_PARTITION)
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

  async setEnabled(enabled: boolean): Promise<GeminiWebSessionActionResult> {
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

  async ensureAuthenticated(): Promise<{ ok: boolean; error?: string; status: GeminiWebSessionStatus }> {
    return this.orchestrator.ensureAuthenticated()
  }

  async dispose(): Promise<void> {
    return this.orchestrator.dispose()
  }
}

export const geminiWebSessionManager = new GeminiWebSessionManager()
