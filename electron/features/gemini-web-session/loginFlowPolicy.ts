import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionConfig,
  GeminiWebSessionStatus
} from '@shared-core/types'

import type { Session } from 'electron'

import { Logger } from '../../core/logger'
import type { ProbeRunner } from './probeRunner'
import type { ProfileLock } from './profileLock'
import { HEALTH_TIMEOUT_MS } from './sessionConfig'
import { toErrorMessage } from './sessionErrors'
import type { SessionMetadataRepository } from './sessionMetadataRepository'
import type { SessionSnapshotRepository } from './sessionSnapshotRepository'
import { nowIso } from './sessionUtils'
import { applyProbeTransition } from './stateMachine'

export interface LoginFlowContext {
  metadataRepository: SessionMetadataRepository
  profileLock: ProfileLock
  probeRunner: ProbeRunner
  config: GeminiWebSessionConfig
  resolvePersistentSession: () => Session
  initialize: () => Promise<void>
  getStatus: () => Promise<GeminiWebSessionStatus>
  snapshotRepository: SessionSnapshotRepository | null
  getAbortSignal: () => AbortSignal
}

export class LoginFlowPolicy {
  constructor(private context: LoginFlowContext) {}

  async openLogin(): Promise<GeminiWebSessionActionResult> {
    const {
      initialize,
      metadataRepository,
      profileLock,
      resolvePersistentSession,
      probeRunner,
      config,
      getStatus,
      getAbortSignal,
      snapshotRepository
    } = this.context
    await initialize()
    const current = await metadataRepository.readMetadata()
    const blocked = metadataRepository.getDisabledActionResult(current)
    if (blocked) return blocked

    const lock = await profileLock.acquire()
    if (!lock.ok) {
      return {
        success: false,
        error: lock.error || 'already_in_use',
        status: await getStatus()
      }
    }

    try {
      const previous = await metadataRepository.readMetadata()

      const probe = await probeRunner.runProbeAcrossApps({
        interactive: false,
        timeoutMs: HEALTH_TIMEOUT_MS
      })
      const transitioned = applyProbeTransition({
        previous,
        outcome: probe.outcome,
        timestamp: nowIso(),
        maxConsecutiveFailures: config.maxConsecutiveFailures
      })

      if (probe.outcome.healthy) {
        const status = await metadataRepository.writeStatus(
          { ...transitioned, state: 'authenticated' },
          probe.accountHash || previous.accountHash
        )
        const targetSession = resolvePersistentSession()
        const freshCookies = await targetSession.cookies.get({}).catch(() => [])
        const freshSnapshot = { cookies: freshCookies, origins: [] }
        await snapshotRepository?.writeStorageStateSnapshot(freshSnapshot).catch(() => {})
        return { success: true, status }
      }

      const status = await metadataRepository.writeStatus(
        { ...transitioned, state: 'auth_required' },
        previous.accountHash
      )
      const error =
        probe.outcome.kind === 'challenge'
          ? 'error_challenge_required'
          : probe.outcome.kind === 'network'
            ? 'error_network_login_failed'
            : probe.timedOut
              ? 'error_login_timeout'
              : 'error_login_verification_failed'
      return { success: false, error, status }
    } catch (error: unknown) {
      const status = await getStatus()
      Logger.error('[GeminiWebSession] Login failed:', toErrorMessage(error, 'unknown_error'))
      return { success: false, error: 'error_login_failed', status }
    } finally {
      await profileLock.release()
    }
  }

  async reauthenticate(): Promise<GeminiWebSessionActionResult> {
    const { initialize, metadataRepository } = this.context
    await initialize()
    const current = await metadataRepository.readMetadata()
    const blocked = metadataRepository.getDisabledActionResult(current)
    if (blocked) return blocked
    await metadataRepository.writeStatus(
      { ...current, state: 'auth_required', reasonCode: 'login_redirect' },
      current.accountHash
    )
    return this.openLogin()
  }
}
