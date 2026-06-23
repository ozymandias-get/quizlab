import type { GeminiWebSessionConfig, GeminiWebSessionStatus } from '@shared-core/types'

import { Logger } from '../../core/logger'
import type { ProbeRunner } from './probeRunner'
import type { ProfileHealthChecker } from './profileHealthChecker'
import type { ProfileLock } from './profileLock'
import { FEATURE_ENABLED, HEALTH_TIMEOUT_MS } from './sessionConfig'
import type { SessionMetadataRepository } from './sessionMetadataRepository'
import type { SessionRecovery } from './sessionRecovery'
import { nowIso } from './sessionUtils'
import { applyProbeTransition } from './stateMachine'

export interface HealthCheckContext {
  metadataRepository: SessionMetadataRepository
  profileLock: ProfileLock
  probeRunner: ProbeRunner
  recovery: SessionRecovery
  config: GeminiWebSessionConfig
  profileHealthChecker: ProfileHealthChecker
}

export class HealthCheckPolicy {
  private activeCheck: Promise<GeminiWebSessionStatus> | null = null

  constructor(private context: HealthCheckContext) {}

  clearActiveCheck() {
    this.activeCheck = null
  }

  getActiveCheck(): Promise<GeminiWebSessionStatus> | null {
    return this.activeCheck
  }

  async performHealthCheck(options: { allowRetry: boolean }): Promise<GeminiWebSessionStatus> {
    if (this.activeCheck) return this.activeCheck

    this.activeCheck = (async () => {
      const {
        metadataRepository,
        profileLock,
        probeRunner,
        recovery,
        config,
        profileHealthChecker
      } = this.context
      const currentBeforeCheck = await metadataRepository.readMetadata()

      if (!FEATURE_ENABLED || !currentBeforeCheck.enabled) {
        return metadataRepository.toPublicStatus(currentBeforeCheck)
      }

      const lock = await profileLock.acquire()
      if (!lock.ok) {
        const current = await metadataRepository.readMetadata()
        const degradedStatus: GeminiWebSessionStatus = {
          state: 'degraded',
          reasonCode: 'unknown',
          lastCheckAt: nowIso(),
          lastHealthyAt: current.lastHealthyAt,
          consecutiveFailures: current.consecutiveFailures,
          featureEnabled: FEATURE_ENABLED,
          enabled: current.enabled,
          enabledAppIds: current.enabledAppIds
        }
        return metadataRepository.writeStatus(degradedStatus, current.accountHash)
      }

      try {
        const current = await metadataRepository.readMetadata()

        const profileHealth = await profileHealthChecker.checkProfileHealth()
        if (!profileHealth.overallHealthy) {
          if (profileHealth.staleLockDetected || !profileHealth.profileDirAccessible) {
            Logger.info('[GeminiWebSession] Profile unhealthy, attempting auto recovery')
            const recoveryResult = await recovery.runAutoProfileRecovery()
            if (!recoveryResult.success) {
              return metadataRepository.writeStatus(
                {
                  ...current,
                  state: 'reauth_required',
                  reasonCode: 'auto_profile_recovery',
                  lastCheckAt: nowIso()
                },
                current.accountHash
              )
            }
            Logger.info('[GeminiWebSession] Auto profile recovery succeeded')
          }
          if (profileHealth.profileSizeWarning) {
            Logger.warn(
              `[GeminiWebSession] Profile size exceeds 100MB: ${profileHealth.profileSizeBytes}`
            )
          }
        }

        let firstProbe = await probeRunner.runProbeAcrossApps({
          interactive: false,
          timeoutMs: HEALTH_TIMEOUT_MS
        })
        let accountHash = firstProbe.outcome.healthy ? firstProbe.accountHash : current.accountHash

        if (recovery.shouldAttemptSilentRefresh(firstProbe.outcome, options.allowRetry)) {
          const refreshProbe = await recovery.runSilentRefreshProbe()
          if (refreshProbe.outcome.healthy) {
            const healedStatus = applyProbeTransition({
              previous: current,
              outcome: refreshProbe.outcome,
              timestamp: nowIso(),
              maxConsecutiveFailures: config.maxConsecutiveFailures
            })
            return metadataRepository.writeStatus(
              healedStatus,
              refreshProbe.accountHash || accountHash
            )
          }
          firstProbe = refreshProbe
        }

        const status = applyProbeTransition({
          previous: current,
          outcome: firstProbe.outcome,
          timestamp: nowIso(),
          maxConsecutiveFailures: config.maxConsecutiveFailures
        })
        return metadataRepository.writeStatus(status, accountHash)
      } finally {
        await profileLock.release()
      }
    })()

    try {
      return await this.activeCheck
    } finally {
      this.activeCheck = null
    }
  }
}
