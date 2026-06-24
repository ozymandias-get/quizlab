import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionConfig,
  GeminiWebSessionStatus
} from '@shared-core/types'

import type { Session } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'

import { Logger } from '../../core/logger.js'
import { HealthCheckPolicy } from './healthCheckPolicy.js'
import { LoginFlowPolicy } from './loginFlowPolicy.js'
import { MetadataUpdatePolicy } from './metadataUpdatePolicy.js'
import { ProbeRunner } from './probeRunner.js'
import { ProfileHealthChecker } from './profileHealthChecker.js'
import { ProfileLock } from './profileLock.js'
import { RefreshTriggerPolicy } from './refreshTriggerPolicy.js'
import {
  COOKIE_REFRESH_THRESHOLD_MS,
  FEATURE_ENABLED,
  PROACTIVE_REFRESH_ADVANCE_MS
} from './sessionConfig.js'
import type { SessionImportResult } from './sessionContracts.js'
import type { ReactiveRefreshSignal, RefreshEventEmitter } from './sessionContracts.js'
import { clearPersistentPartitionData } from './sessionCookies.js'
import { logSuppressedError, toErrorMessage } from './sessionErrors.js'
import { SessionExportImport } from './sessionExportImport.js'
import { SessionMetadataRepository } from './sessionMetadataRepository.js'
import { SessionMonitor } from './sessionMonitor.js'
import { SessionRecovery } from './sessionRecovery.js'
import { SessionSnapshotRepository } from './sessionSnapshotRepository.js'
import { nowIso } from './sessionUtils.js'
import { createDefaultStatus } from './stateMachine.js'

export class SessionOrchestrator {
  private readonly config: GeminiWebSessionConfig
  private readonly profileDir: string
  private readonly metadataRepository: SessionMetadataRepository
  private readonly profileLock: ProfileLock
  private readonly probeRunner: ProbeRunner
  private readonly recovery: SessionRecovery
  private readonly monitor: SessionMonitor
  private readonly resolvePersistentSession: () => Session
  private readonly emitRefreshEvent: RefreshEventEmitter
  private readonly snapshotRepository: SessionSnapshotRepository
  private readonly profileHealthChecker: ProfileHealthChecker

  private initialized = false

  private healthCheckPolicy: HealthCheckPolicy
  private refreshTriggerPolicy: RefreshTriggerPolicy
  private loginFlowPolicy: LoginFlowPolicy
  private metadataUpdatePolicy: MetadataUpdatePolicy

  private abortController = new AbortController()

  constructor(options: {
    config: GeminiWebSessionConfig
    paths: {
      profileDir: string
      configPath: string
      lockPath: string
      storageStateSnapshotPath: string
    }
    resolvePersistentSession: () => Session
    emitRefreshEvent?: RefreshEventEmitter
  }) {
    this.config = options.config
    this.profileDir = options.paths.profileDir
    this.resolvePersistentSession = options.resolvePersistentSession
    this.metadataRepository = new SessionMetadataRepository(options.paths.configPath)
    this.snapshotRepository = new SessionSnapshotRepository(options.paths.storageStateSnapshotPath)
    this.profileHealthChecker = new ProfileHealthChecker(this.profileDir, options.paths.lockPath)
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
      resolvePersistentSession: () => this.resolvePersistentSession(),
      snapshotRepository: this.snapshotRepository
    })
    this.monitor = new SessionMonitor()
    this.emitRefreshEvent = options.emitRefreshEvent || (() => {})

    this.healthCheckPolicy = new HealthCheckPolicy({
      metadataRepository: this.metadataRepository,
      profileLock: this.profileLock,
      probeRunner: this.probeRunner,
      recovery: this.recovery,
      config: this.config,
      profileHealthChecker: this.profileHealthChecker
    })

    this.refreshTriggerPolicy = new RefreshTriggerPolicy({
      metadataRepository: this.metadataRepository,
      profileLock: this.profileLock,
      recovery: this.recovery,
      config: this.config,
      resolvePersistentSession: this.resolvePersistentSession,
      emitRefreshEvent: this.emitRefreshEvent,
      initialize: () => this.initialize(),
      getActiveCheck: () => this.healthCheckPolicy.getActiveCheck(),
      getAbortSignal: () => this.abortController.signal
    })

    this.loginFlowPolicy = new LoginFlowPolicy({
      metadataRepository: this.metadataRepository,
      profileLock: this.profileLock,
      probeRunner: this.probeRunner,
      config: this.config,
      resolvePersistentSession: this.resolvePersistentSession,
      initialize: () => this.initialize(),
      getStatus: () => this.getStatus(),
      snapshotRepository: this.snapshotRepository,
      getAbortSignal: () => this.abortController.signal
    })

    this.metadataUpdatePolicy = new MetadataUpdatePolicy({
      metadataRepository: this.metadataRepository,
      monitor: this.monitor,
      initialize: () => this.initialize(),
      scheduleMonitor: () => this.scheduleMonitor(),
      performHealthCheck: (opts) => this.healthCheckPolicy.performHealthCheck(opts)
    })
  }

  getConfig(): GeminiWebSessionConfig {
    return this.config
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await this.ensureProfileDirectory()
    await this.metadataRepository.ensureMetadata()

    this.refreshTriggerPolicy.configureReactiveRefreshListeners()

    this.initialized = true
    const metadata = await this.metadataRepository.readMetadata()
    if (FEATURE_ENABLED && metadata.enabled) {
      this.scheduleMonitor()
      void this.healthCheckPolicy.performHealthCheck({ allowRetry: false }).catch((error) => {
        logSuppressedError('initial health check failed', error)
      })
    }
  }

  async getStatus(): Promise<GeminiWebSessionStatus> {
    await this.initialize()
    const metadata = await this.metadataRepository.readMetadata()
    return this.metadataRepository.toPublicStatus(metadata)
  }

  async setEnabled(enabled: unknown): Promise<GeminiWebSessionActionResult> {
    return this.metadataUpdatePolicy.setEnabled(enabled)
  }

  async setEnabledApps(enabledAppIds: string[]): Promise<GeminiWebSessionActionResult> {
    return this.metadataUpdatePolicy.setEnabledApps(enabledAppIds)
  }

  async openLogin(): Promise<GeminiWebSessionActionResult> {
    return this.loginFlowPolicy.openLogin()
  }

  async checkNow(): Promise<GeminiWebSessionActionResult> {
    await this.initialize()
    const current = await this.metadataRepository.readMetadata()
    const blocked = this.metadataRepository.getDisabledActionResult(current)
    if (blocked) return blocked
    const status = await this.healthCheckPolicy.performHealthCheck({ allowRetry: true })
    return { success: true, status }
  }

  async reauthenticate(): Promise<GeminiWebSessionActionResult> {
    return this.loginFlowPolicy.reauthenticate()
  }

  async exportSession(filePath: string): Promise<{ success: boolean; error?: string }> {
    await this.initialize()
    const exporter = new SessionExportImport(
      this.snapshotRepository,
      this.metadataRepository,
      this.probeRunner
    )
    return exporter.exportSession(filePath)
  }

  async importSession(filePath: string): Promise<SessionImportResult> {
    await this.initialize()
    const importer = new SessionExportImport(
      this.snapshotRepository,
      this.metadataRepository,
      this.probeRunner
    )
    return importer.importSession(filePath)
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

      const activeCheck = this.healthCheckPolicy.getActiveCheck()
      if (activeCheck) {
        await activeCheck.catch((error) => {
          logSuppressedError('active check join failed during checkNow', error)
        })
      }

      const current = await this.metadataRepository.readMetadata()
      await this.snapshotRepository?.clearSnapshot().catch(() => {})
      await this.clearPersistentPartitionData()
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
      Logger.error(
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
    const result = await this.healthCheckPolicy.performHealthCheck({ allowRetry: true })
    if (result.state === 'authenticated') return { ok: true, status: result }
    if (result.state === 'reauth_required')
      return { ok: false, error: 'reauth_required', status: result }
    return { ok: false, error: 'session_unavailable', status: result }
  }

  async dispose(): Promise<void> {
    this.monitor.stop()
    this.abortController.abort()

    const activeRefresh = this.refreshTriggerPolicy.getActiveRefresh()
    if (activeRefresh) {
      await activeRefresh.catch((error) => {
        logSuppressedError('active refresh join failed during dispose', error)
      })
      this.refreshTriggerPolicy.clearActiveRefresh()
    }

    const activeCheck = this.healthCheckPolicy.getActiveCheck()
    if (activeCheck) {
      await activeCheck.catch((error) => {
        logSuppressedError('active check join failed during dispose', error)
      })
      this.healthCheckPolicy.clearActiveCheck()
    }

    await this.profileLock.release()
  }

  private async ensureProfileDirectory(): Promise<void> {
    await fs.mkdir(this.profileDir, { recursive: true, mode: 0o700 }).catch((error) => {
      logSuppressedError('profile directory mkdir failed', error)
    })
    if (process.platform !== 'win32') {
      await fs.chmod(this.profileDir, 0o700).catch((error) => {
        logSuppressedError('profile chmod failed', error)
      })
    }
  }

  private async clearPersistentPartitionData(): Promise<void> {
    await clearPersistentPartitionData(this.resolvePersistentSession())
  }

  private scheduleMonitor(): void {
    if (!FEATURE_ENABLED) return
    this.monitor.schedule(this.config.checkIntervalMs, this.config.jitterPct, async () => {
      try {
        const targetSession = this.resolvePersistentSession()
        const cookieExpiry = await this.monitor.inspectCookieExpiry(
          targetSession,
          COOKIE_REFRESH_THRESHOLD_MS,
          PROACTIVE_REFRESH_ADVANCE_MS
        )
        if (cookieExpiry.shouldRefresh || cookieExpiry.proactiveRefreshDue) {
          await this.triggerRefresh({
            reason: 'proactive_expiry'
          })
        }

        await this.healthCheckPolicy.performHealthCheck({ allowRetry: true })
      } catch (error: unknown) {
        Logger.error(
          '[GeminiWebSession] Monitor check failed:',
          toErrorMessage(error, 'unknown_error')
        )
      } finally {
        this.scheduleMonitor()
      }
    })
  }

  async triggerRefresh(signal: ReactiveRefreshSignal): Promise<void> {
    return this.refreshTriggerPolicy.triggerRefresh(signal)
  }
}
