import type { Session } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

import { GOOGLE_SIGNIN_URL } from './constants'
import type { ProbeRunner } from './probeRunner'
import {
  HEALTH_TIMEOUT_MS,
  REFRESH_GRACE_PERIOD_MS,
  SILENT_REFRESH_COOLDOWN_MS,
  SILENT_REFRESH_TIMEOUT_MS
} from './sessionConfig'
import type { ProbeExecutionResult } from './sessionContracts'
import { importExternalCookies } from './sessionCookies'
import type { SessionMetadataRepository } from './sessionMetadataRepository'
import type { SessionSnapshotRepository } from './sessionSnapshotRepository'
import type { ProbeOutcome } from './stateMachine'

export class SessionRecovery {
  private readonly probeRunner: ProbeRunner
  private readonly resolvePersistentSession: () => Session
  private readonly snapshotRepository: SessionSnapshotRepository | null
  private readonly metadataRepository: SessionMetadataRepository | null
  private lastSilentRefreshAttemptAt = 0
  private lastRefreshSucceededAt = 0

  constructor(options: {
    probeRunner: ProbeRunner
    resolvePersistentSession: () => Session
    snapshotRepository?: SessionSnapshotRepository | null
    metadataRepository?: SessionMetadataRepository | null
  }) {
    this.probeRunner = options.probeRunner
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
    this.lastRefreshSucceededAt = 0
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

  markRefreshSuccess(): void {
    this.lastRefreshSucceededAt = Date.now()
  }

  isWithinRefreshGracePeriod(): boolean {
    return Date.now() - this.lastRefreshSucceededAt < REFRESH_GRACE_PERIOD_MS
  }

  shouldAttemptSilentRefresh(outcome: ProbeOutcome, allowRetry: boolean): boolean {
    if (!allowRetry) return false
    if (outcome.healthy) return false
    if (outcome.kind === 'network' || outcome.kind === 'challenge') return false
    if (outcome.kind !== 'login_redirect' && outcome.kind !== 'unknown') return false

    const now = Date.now()
    if (now - this.lastSilentRefreshAttemptAt < SILENT_REFRESH_COOLDOWN_MS) {
      return false
    }
    return true
  }

  async runSilentRefreshProbe(): Promise<ProbeExecutionResult> {
    this.lastSilentRefreshAttemptAt = Date.now()

    const signinProbe = await this.probeRunner.runProbe({
      interactive: false,
      timeoutMs: SILENT_REFRESH_TIMEOUT_MS,
      initialUrl: GOOGLE_SIGNIN_URL
    })
    if (signinProbe.outcome.healthy) return signinProbe

    return this.probeRunner.runProbeAcrossApps({
      interactive: false,
      timeoutMs: HEALTH_TIMEOUT_MS
    })
  }
}
