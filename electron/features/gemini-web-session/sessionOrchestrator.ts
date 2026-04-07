import { promises as fs } from 'fs'
import type { Session } from 'electron'
import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionConfig,
  GeminiWebSessionStatus
} from '@shared-core/types'
import { createDefaultStatus, applyProbeTransition } from './stateMachine'
import { runPlaywrightLogin } from './playwrightLogin'
import { clearPersistentPartitionData, importExternalCookies } from './sessionCookies'
import { FEATURE_ENABLED, HEALTH_TIMEOUT_MS, LOGIN_TIMEOUT_MS } from './sessionConfig'
import { nowIso } from './sessionUtils'
import { toErrorMessage } from './sessionErrors'
import { SessionMetadataRepository, sanitizeEnabledAppIds } from './sessionMetadataRepository'
import { ProfileLock } from './profileLock'
import { ProbeRunner } from './probeRunner'
import { SessionRecovery } from './sessionRecovery'
import { SessionMonitor } from './sessionMonitor'

function logSuppressedError(context: string, error: unknown): void {
  console.warn(`[GeminiWebSession] ${context}:`, toErrorMessage(error, 'unknown_error'))
}

export class SessionOrchestrator {
  private readonly config: GeminiWebSessionConfig
  private readonly profileDir: string
  private readonly playwrightProfileDir: string
  private readonly metadataRepository: SessionMetadataRepository
  private readonly profileLock: ProfileLock
  private readonly probeRunner: ProbeRunner
  private readonly recovery: SessionRecovery
  private readonly monitor: SessionMonitor
  private readonly resolvePersistentSession: () => Session

  private initialized = false
  private activeCheck: Promise<GeminiWebSessionStatus> | null = null

  constructor(options: {
    config: GeminiWebSessionConfig
    paths: {
      profileDir: string
      playwrightProfileDir: string
      configPath: string
      lockPath: string
    }
    resolvePersistentSession: () => Session
  }) {
    this.config = options.config
    this.profileDir = options.paths.profileDir
    this.playwrightProfileDir = options.paths.playwrightProfileDir
    this.resolvePersistentSession = options.resolvePersistentSession
    this.metadataRepository = new SessionMetadataRepository(options.paths.configPath)
    this.profileLock = new ProfileLock({
      lockPath: options.paths.lockPath,
      ensureProfileDirectory: () => this.ensureProfileDirectory()
    })
    this.probeRunner = new ProbeRunner({
      ensureProfileDirectory: () => this.ensureProfileDirectory(),
      resolvePersistentSession: () => this.resolvePersistentSession()
    })
    this.recovery = new SessionRecovery({
      probeRunner: this.probeRunner,
      playwrightProfileDir: this.playwrightProfileDir,
      resolvePersistentSession: () => this.resolvePersistentSession()
    })
    this.monitor = new SessionMonitor()
  }

  getConfig(): GeminiWebSessionConfig {
    return this.config
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await this.ensureProfileDirectory()
    await this.metadataRepository.ensureMetadata()
    this.initialized = true
    const metadata = await this.metadataRepository.readMetadata()
    if (FEATURE_ENABLED && metadata.enabled) {
      this.scheduleMonitor()
      void this.performHealthCheck({ allowRetry: false }).catch((error) => {
        logSuppressedError('initial health check failed', error)
      })
    }
  }

  async getStatus(): Promise<GeminiWebSessionStatus> {
    await this.initialize()
    const metadata = await this.metadataRepository.readMetadata()
    return this.metadataRepository.toPublicStatus(metadata)
  }

  async setEnabled(enabled: boolean): Promise<GeminiWebSessionActionResult> {
    await this.initialize()
    const current = await this.metadataRepository.readMetadata()
    const nextEnabled = FEATURE_ENABLED ? !!enabled : false
    const status = await this.metadataRepository.writeStatus(
      {
        ...current,
        enabled: nextEnabled,
        featureEnabled: FEATURE_ENABLED,
        lastCheckAt: nowIso()
      },
      current.accountHash
    )
    if (!nextEnabled) {
      this.monitor.stop()
    }
    if (nextEnabled) {
      this.scheduleMonitor()
      void this.performHealthCheck({ allowRetry: false }).catch((error) => {
        logSuppressedError('setEnabled health check failed', error)
      })
    }
    return { success: true, status }
  }

  async setEnabledApps(enabledAppIds: string[]): Promise<GeminiWebSessionActionResult> {
    await this.initialize()
    const current = await this.metadataRepository.readMetadata()
    const status = await this.metadataRepository.writeStatus(
      {
        ...current,
        enabledAppIds: sanitizeEnabledAppIds(enabledAppIds),
        lastCheckAt: nowIso()
      },
      current.accountHash
    )
    return { success: true, status }
  }

  async openLogin(): Promise<GeminiWebSessionActionResult> {
    await this.initialize()
    const current = await this.metadataRepository.readMetadata()
    const blocked = this.metadataRepository.getDisabledActionResult(current)
    if (blocked) return blocked

    const lock = await this.profileLock.acquire()
    if (!lock.ok) {
      return {
        success: false,
        error: lock.error || 'already_in_use',
        status: await this.getStatus()
      }
    }

    try {
      const previous = await this.metadataRepository.readMetadata()
      const loginResult = await runPlaywrightLogin({
        profileDir: this.playwrightProfileDir,
        timeoutMs: LOGIN_TIMEOUT_MS
      })
      if (!loginResult.success) {
        const transitioned = applyProbeTransition({
          previous,
          outcome: loginResult.outcome,
          timestamp: nowIso(),
          maxConsecutiveFailures: this.config.maxConsecutiveFailures
        })
        const failureStatus = await this.metadataRepository.writeStatus(
          { ...transitioned, state: 'auth_required' },
          previous.accountHash
        )
        return {
          success: false,
          error: loginResult.error || 'error_login_failed',
          status: failureStatus
        }
      }

      const targetSession = this.resolvePersistentSession()
      await importExternalCookies(targetSession, loginResult.cookies)

      const probe = await this.probeRunner.runProbeAcrossApps({
        interactive: false,
        timeoutMs: HEALTH_TIMEOUT_MS
      })
      const transitioned = applyProbeTransition({
        previous,
        outcome: probe.outcome,
        timestamp: nowIso(),
        maxConsecutiveFailures: this.config.maxConsecutiveFailures
      })
      const status = await this.metadataRepository.writeStatus(
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
      const status = await this.getStatus()
      console.error('[GeminiWebSession] Login failed:', toErrorMessage(error, 'unknown_error'))
      return { success: false, error: 'error_login_failed', status }
    } finally {
      await this.profileLock.release()
    }
  }

  async checkNow(): Promise<GeminiWebSessionActionResult> {
    await this.initialize()
    const current = await this.metadataRepository.readMetadata()
    const blocked = this.metadataRepository.getDisabledActionResult(current)
    if (blocked) return blocked
    const status = await this.performHealthCheck({ allowRetry: true })
    return { success: true, status }
  }

  async reauthenticate(): Promise<GeminiWebSessionActionResult> {
    await this.initialize()
    const current = await this.metadataRepository.readMetadata()
    const blocked = this.metadataRepository.getDisabledActionResult(current)
    if (blocked) return blocked
    await this.metadataRepository.writeStatus(
      { ...current, state: 'auth_required', reasonCode: 'login_redirect' },
      current.accountHash
    )
    return this.openLogin()
  }

  async resetProfile(): Promise<GeminiWebSessionActionResult> {
    await this.initialize()
    const lock = await this.profileLock.acquire()
    if (!lock.ok) {
      return {
        success: false,
        error: lock.error || 'already_in_use',
        status: await this.getStatus()
      }
    }
    try {
      this.monitor.stop()
      if (this.activeCheck) {
        await this.activeCheck.catch((error) => {
          logSuppressedError('active check join failed during checkNow', error)
        })
      }
      const current = await this.metadataRepository.readMetadata()
      await this.clearPersistentPartitionData()
      await this.clearPlaywrightProfileData()
      await this.ensureProfileDirectory()
      this.recovery.resetCooldowns()
      const status = await this.metadataRepository.writeStatus(
        {
          ...createDefaultStatus(FEATURE_ENABLED, current.enabled),
          state: 'auth_required',
          reasonCode: 'reset_profile_required',
          lastCheckAt: nowIso(),
          enabledAppIds: current.enabledAppIds
        },
        null
      )
      if (FEATURE_ENABLED && current.enabled) {
        this.scheduleMonitor()
      }
      return { success: true, status }
    } catch (error: unknown) {
      console.error(
        '[GeminiWebSession] Reset profile failed:',
        toErrorMessage(error, 'unknown_error')
      )
      return { success: false, error: 'reset_failed', status: await this.getStatus() }
    } finally {
      await this.profileLock.release()
    }
  }

  async ensureAuthenticated(): Promise<{
    ok: boolean
    error?: string
    status: GeminiWebSessionStatus
  }> {
    await this.initialize()
    const currentMetadata = await this.metadataRepository.readMetadata()
    const current = this.metadataRepository.toPublicStatus(currentMetadata)
    const blocked = this.metadataRepository.getDisabledActionResult(currentMetadata)
    if (blocked) {
      return { ok: false, error: blocked.error, status: blocked.status }
    }
    if (current.state === 'authenticated') return { ok: true, status: current }
    if (current.state === 'reauth_required')
      return { ok: false, error: 'reauth_required', status: current }
    const result = await this.performHealthCheck({ allowRetry: true })
    if (result.state === 'authenticated') return { ok: true, status: result }
    if (result.state === 'reauth_required')
      return { ok: false, error: 'reauth_required', status: result }
    return { ok: false, error: 'session_unavailable', status: result }
  }

  async dispose(): Promise<void> {
    this.monitor.stop()
    if (this.activeCheck) {
      await this.activeCheck.catch((error) => {
        logSuppressedError('active check join failed during dispose', error)
      })
      this.activeCheck = null
    }
    await this.profileLock.release()
  }

  private async ensureProfileDirectory(): Promise<void> {
    await fs.mkdir(this.profileDir, { recursive: true, mode: 0o700 }).catch((error) => {
      logSuppressedError('profile directory mkdir failed', error)
    })
    await fs.mkdir(this.playwrightProfileDir, { recursive: true, mode: 0o700 }).catch((error) => {
      logSuppressedError('playwright profile directory mkdir failed', error)
    })
    if (process.platform !== 'win32') {
      await fs.chmod(this.profileDir, 0o700).catch((error) => {
        logSuppressedError('profile chmod failed', error)
      })
      await fs.chmod(this.playwrightProfileDir, 0o700).catch((error) => {
        logSuppressedError('playwright profile chmod failed', error)
      })
    }
  }

  private async clearPersistentPartitionData(): Promise<void> {
    await clearPersistentPartitionData(this.resolvePersistentSession())
  }

  private async clearPlaywrightProfileData(): Promise<void> {
    await fs.rm(this.playwrightProfileDir, { recursive: true, force: true }).catch((error) => {
      logSuppressedError('cleanup playwright profile failed', error)
    })
  }

  private scheduleMonitor(): void {
    if (!FEATURE_ENABLED) return
    this.monitor.schedule(this.config.checkIntervalMs, this.config.jitterPct, async () => {
      try {
        await this.performHealthCheck({ allowRetry: true })
      } catch (error: unknown) {
        console.error(
          '[GeminiWebSession] Monitor check failed:',
          toErrorMessage(error, 'unknown_error')
        )
      } finally {
        this.scheduleMonitor()
      }
    })
  }

  private async performHealthCheck(options: {
    allowRetry: boolean
  }): Promise<GeminiWebSessionStatus> {
    if (this.activeCheck) return this.activeCheck
    this.activeCheck = (async () => {
      const currentBeforeCheck = await this.metadataRepository.readMetadata()
      if (!FEATURE_ENABLED || !currentBeforeCheck.enabled) {
        return this.metadataRepository.toPublicStatus(currentBeforeCheck)
      }
      const lock = await this.profileLock.acquire()
      if (!lock.ok) {
        const current = await this.metadataRepository.readMetadata()
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
        return this.metadataRepository.writeStatus(degradedStatus, current.accountHash)
      }
      try {
        const current = await this.metadataRepository.readMetadata()
        let firstProbe = await this.probeRunner.runProbeAcrossApps({
          interactive: false,
          timeoutMs: HEALTH_TIMEOUT_MS
        })
        let accountHash = firstProbe.outcome.healthy ? firstProbe.accountHash : current.accountHash

        if (this.recovery.shouldAttemptSilentRefresh(firstProbe.outcome, options.allowRetry)) {
          const refreshProbe = await this.recovery.runSilentRefreshProbe()
          if (refreshProbe.outcome.healthy) {
            const healedStatus = applyProbeTransition({
              previous: current,
              outcome: refreshProbe.outcome,
              timestamp: nowIso(),
              maxConsecutiveFailures: this.config.maxConsecutiveFailures
            })
            return this.metadataRepository.writeStatus(
              healedStatus,
              refreshProbe.accountHash || accountHash
            )
          }
          firstProbe = refreshProbe
        }

        if (
          this.recovery.shouldAttemptPlaywrightHeadlessRefresh(
            firstProbe.outcome,
            options.allowRetry
          )
        ) {
          const playwrightProbe = await this.recovery.runPlaywrightHeadlessRefreshProbe(accountHash)
          if (playwrightProbe) {
            firstProbe = playwrightProbe
            accountHash = firstProbe.outcome.healthy
              ? firstProbe.accountHash || accountHash
              : accountHash
            if (firstProbe.outcome.healthy) {
              const recoveredStatus = applyProbeTransition({
                previous: current,
                outcome: firstProbe.outcome,
                timestamp: nowIso(),
                maxConsecutiveFailures: this.config.maxConsecutiveFailures
              })
              return this.metadataRepository.writeStatus(recoveredStatus, accountHash)
            }
          }
        }

        const status = applyProbeTransition({
          previous: current,
          outcome: firstProbe.outcome,
          timestamp: nowIso(),
          maxConsecutiveFailures: this.config.maxConsecutiveFailures
        })
        return this.metadataRepository.writeStatus(status, accountHash)
      } finally {
        await this.profileLock.release()
      }
    })()
    try {
      return await this.activeCheck
    } finally {
      this.activeCheck = null
    }
  }
}
