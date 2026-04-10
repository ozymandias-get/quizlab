import { nowIso } from './sessionUtils'
import { applyProbeTransition } from './stateMachine'
import { runPlaywrightLogin } from './playwrightLogin'
import { importExternalCookies } from './sessionCookies'
import { LOGIN_TIMEOUT_MS, HEALTH_TIMEOUT_MS } from './sessionConfig'
import type { Session } from 'electron'
import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionConfig,
  GeminiWebSessionStatus
} from '@shared-core/types'
import type { SessionMetadataRepository } from './sessionMetadataRepository'
import type { ProfileLock } from './profileLock'
import type { ProbeRunner } from './probeRunner'

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return fallback
}

export interface LoginFlowContext {
  metadataRepository: SessionMetadataRepository
  profileLock: ProfileLock
  probeRunner: ProbeRunner
  config: GeminiWebSessionConfig
  playwrightProfileDir: string
  resolvePersistentSession: () => Session
  initialize: () => Promise<void>
  getStatus: () => Promise<GeminiWebSessionStatus>
}

export class LoginFlowPolicy {
  constructor(private context: LoginFlowContext) {}

  async openLogin(): Promise<GeminiWebSessionActionResult> {
    const {
      initialize,
      metadataRepository,
      profileLock,
      playwrightProfileDir,
      resolvePersistentSession,
      probeRunner,
      config,
      getStatus
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
      const loginResult = await runPlaywrightLogin({
        profileDir: playwrightProfileDir,
        timeoutMs: LOGIN_TIMEOUT_MS
      })

      if (!loginResult.success) {
        const transitioned = applyProbeTransition({
          previous,
          outcome: loginResult.outcome,
          timestamp: nowIso(),
          maxConsecutiveFailures: config.maxConsecutiveFailures
        })
        const failureStatus = await metadataRepository.writeStatus(
          { ...transitioned, state: 'auth_required' },
          previous.accountHash
        )
        return {
          success: false,
          error: loginResult.error || 'error_login_failed',
          status: failureStatus
        }
      }

      const targetSession = resolvePersistentSession()
      await importExternalCookies(targetSession, loginResult.cookies)

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
      const status = await metadataRepository.writeStatus(
        probe.outcome.healthy
          ? { ...transitioned, state: 'authenticated' }
          : { ...transitioned, state: 'auth_required' },
        probe.outcome.healthy ? probe.accountHash || loginResult.accountHash : previous.accountHash
      )
      if (probe.outcome.healthy) {
        return { success: true, status }
      }
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
      console.error('[GeminiWebSession] Login failed:', toErrorMessage(error, 'unknown_error'))
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
