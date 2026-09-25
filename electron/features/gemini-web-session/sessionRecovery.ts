import type { Session } from 'electron'

import { REFRESH_GRACE_PERIOD_MS, SILENT_REFRESH_COOLDOWN_MS } from './sessionConfig.js'
import type { ProbeExecutionResult } from './sessionContracts.js'
import type { SessionMetadataRepository } from './sessionMetadataRepository.js'
import { probePersistentSession } from './sessionProbe.js'
import type { SessionSnapshotRepository } from './sessionSnapshotRepository.js'
import type { ProbeOutcome } from './stateMachine.js'

type ProbeSession = (session: Session, signal?: AbortSignal) => Promise<ProbeExecutionResult>

export class SessionRecovery {
  private readonly resolvePersistentSession: () => Session
  private readonly ensureProfileDirectory: () => Promise<void>
  private readonly probeSession: ProbeSession
  private readonly snapshotRepository: SessionSnapshotRepository | null
  private readonly metadataRepository: Pick<
    SessionMetadataRepository,
    'readMetadata' | 'writeStatus'
  > | null
  private lastSilentRefreshAttemptAt = 0
  private lastRefreshSucceededAt = 0

  constructor(options: {
    resolvePersistentSession: () => Session
    ensureProfileDirectory?: () => Promise<void>
    probeSession?: ProbeSession
    snapshotRepository?: SessionSnapshotRepository | null
    metadataRepository?: Pick<SessionMetadataRepository, 'readMetadata' | 'writeStatus'> | null
  }) {
    this.resolvePersistentSession = options.resolvePersistentSession
    this.ensureProfileDirectory = options.ensureProfileDirectory ?? (async () => {})
    this.probeSession = options.probeSession ?? probePersistentSession
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
    this.lastRefreshSucceededAt = 0
  }

  markRefreshSuccess(): void {
    this.lastRefreshSucceededAt = Date.now()
  }

  isWithinRefreshGracePeriod(): boolean {
    return Date.now() - this.lastRefreshSucceededAt < REFRESH_GRACE_PERIOD_MS
  }

  isWithinSilentRefreshCooldown(): boolean {
    return Date.now() - this.lastSilentRefreshAttemptAt < SILENT_REFRESH_COOLDOWN_MS
  }

  shouldAttemptSilentRefresh(outcome: ProbeOutcome, allowRetry: boolean): boolean {
    if (!allowRetry || outcome.healthy) return false
    if (outcome.kind === 'network' || outcome.kind === 'challenge') return false
    if (outcome.kind !== 'login_redirect' && outcome.kind !== 'unknown') return false
    return Date.now() - this.lastSilentRefreshAttemptAt >= SILENT_REFRESH_COOLDOWN_MS
  }

  async runSilentRefreshProbe(signal?: AbortSignal): Promise<ProbeExecutionResult> {
    this.lastSilentRefreshAttemptAt = Date.now()
    try {
      await this.ensureProfileDirectory()
      return await this.probeSession(this.resolvePersistentSession(), signal)
    } finally {
      await this.persistCooldowns()
    }
  }

  async runAutoProfileRecovery(): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'auto_recovery_unavailable' }
  }
}
