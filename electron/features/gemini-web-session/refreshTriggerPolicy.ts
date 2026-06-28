import type { GeminiWebSessionConfig, GeminiWebSessionStatus } from '@shared-core/types'

import type { Session } from 'electron'

import type { ProfileLock } from './profileLock.js'
import type { ReactiveRefreshSignal, RefreshEventEmitter } from './sessionContracts.js'
import type { SessionMetadataRepository } from './sessionMetadataRepository.js'
import type { SessionRecovery } from './sessionRecovery.js'

export interface RefreshTriggerContext {
  metadataRepository: SessionMetadataRepository
  profileLock: ProfileLock
  recovery: SessionRecovery
  config: GeminiWebSessionConfig
  resolvePersistentSession: () => Session
  emitRefreshEvent: RefreshEventEmitter
  initialize: () => Promise<void>
  getActiveCheck: () => Promise<GeminiWebSessionStatus> | null
  getAbortSignal: () => AbortSignal
}

export class RefreshTriggerPolicy {
  private activeRefresh: Promise<void> | null = null

  constructor(private context: RefreshTriggerContext) {}

  getActiveRefresh(): Promise<void> | null {
    return this.activeRefresh
  }

  clearActiveRefresh() {
    this.activeRefresh = null
  }

  configureReactiveRefreshListeners(): void {}

  async triggerRefresh(signal: ReactiveRefreshSignal): Promise<void> {
    return
  }
}
