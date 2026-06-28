import type { Session } from 'electron'

import type { SessionMetadataRepository } from './sessionMetadataRepository.js'
import type { SessionSnapshotRepository } from './sessionSnapshotRepository.js'

export class SessionRecovery {
  private readonly resolvePersistentSession: () => Session
  private readonly snapshotRepository: SessionSnapshotRepository | null
  private readonly metadataRepository: SessionMetadataRepository | null
  private lastSilentRefreshAttemptAt = 0

  constructor(options: {
    resolvePersistentSession: () => Session
    snapshotRepository?: SessionSnapshotRepository | null
    metadataRepository?: SessionMetadataRepository | null
  }) {
    this.resolvePersistentSession = options.resolvePersistentSession
    this.snapshotRepository = options.snapshotRepository ?? null
    this.metadataRepository = options.metadataRepository ?? null
  }

  async loadPersistedCooldowns(): Promise<void> {
    if (!this.metadataRepository) return
    try {
      const metadata = await this.metadataRepository.readMetadata()
      this.lastSilentRefreshAttemptAt = metadata.lastSilentRefreshAttemptAt ?? 0
    } catch {}
  }

  async persistCooldowns(): Promise<void> {
    if (!this.metadataRepository) return
    try {
      const metadata = await this.metadataRepository.readMetadata()
      await this.metadataRepository.writeStatus(
        {
          ...metadata,
          lastCheckAt: new Date().toISOString()
        },
        metadata.accountHash,
        {
          lastSilentRefreshAttemptAt: this.lastSilentRefreshAttemptAt
        }
      )
    } catch {}
  }

  resetCooldowns(): void {
    this.lastSilentRefreshAttemptAt = 0
  }

  async runAutoProfileRecovery(): Promise<{ success: boolean; error?: string }> {
    try {
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'auto_recovery_failed'
      }
    }
  }
}
