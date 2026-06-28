import type { GeminiWebSessionConfig, GeminiWebSessionStatus } from '@shared-core/types'

import { Logger } from '../../core/logger.js'
import type { ProfileHealthChecker } from './profileHealthChecker.js'
import type { ProfileLock } from './profileLock.js'
import { FEATURE_ENABLED } from './sessionConfig.js'
import type { SessionMetadataRepository } from './sessionMetadataRepository.js'
import type { SessionRecovery } from './sessionRecovery.js'
import { nowIso } from './sessionUtils.js'

export interface HealthCheckContext {
  metadataRepository: SessionMetadataRepository
  profileLock: ProfileLock
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
      const { metadataRepository, profileLock, recovery, config, profileHealthChecker } =
        this.context
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

        const updated = await metadataRepository.readMetadata()
        return metadataRepository.toPublicStatus(updated)
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
