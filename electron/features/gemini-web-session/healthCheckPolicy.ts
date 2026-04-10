import { nowIso } from './sessionUtils'
import { applyProbeTransition } from './stateMachine'
import { FEATURE_ENABLED, HEALTH_TIMEOUT_MS } from './sessionConfig'
import type { GeminiWebSessionStatus, GeminiWebSessionConfig } from '@shared-core/types'
import type { SessionMetadataRepository } from './sessionMetadataRepository'
import type { ProfileLock } from './profileLock'
import type { ProbeRunner } from './probeRunner'
import type { SessionRecovery } from './sessionRecovery'

export interface HealthCheckContext {
  metadataRepository: SessionMetadataRepository
  profileLock: ProfileLock
  probeRunner: ProbeRunner
  recovery: SessionRecovery
  config: GeminiWebSessionConfig
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
      const { metadataRepository, profileLock, probeRunner, recovery, config } = this.context
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

        if (
          recovery.shouldAttemptPlaywrightHeadlessRefresh(firstProbe.outcome, options.allowRetry)
        ) {
          const playwrightProbe = await recovery.runPlaywrightHeadlessRefreshProbe(accountHash)
          if (playwrightProbe.probe) {
            firstProbe = playwrightProbe.probe
            accountHash = firstProbe.outcome.healthy
              ? firstProbe.accountHash || accountHash
              : accountHash
            if (firstProbe.outcome.healthy) {
              recovery.markRefreshSuccess()
              const recoveredStatus = applyProbeTransition({
                previous: current,
                outcome: firstProbe.outcome,
                timestamp: nowIso(),
                maxConsecutiveFailures: config.maxConsecutiveFailures
              })
              return metadataRepository.writeStatus(recoveredStatus, accountHash)
            }
          } else if (playwrightProbe.error === 'error_refresh_failed_requires_login') {
            return metadataRepository.writeStatus(
              {
                ...current,
                state: 'reauth_required',
                reasonCode: 'login_redirect',
                lastCheckAt: nowIso()
              },
              accountHash
            )
          }
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
