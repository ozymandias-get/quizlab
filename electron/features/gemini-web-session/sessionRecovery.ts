import { GOOGLE_SIGNIN_URL } from './constants'
import type { Session } from 'electron'
import { importExternalCookies } from './sessionCookies'
import {
  HEALTH_TIMEOUT_MS,
  PLAYWRIGHT_HEADLESS_REFRESH_COOLDOWN_MS,
  PLAYWRIGHT_HEADLESS_REFRESH_TIMEOUT_MS,
  SILENT_REFRESH_COOLDOWN_MS,
  SILENT_REFRESH_TIMEOUT_MS
} from './sessionConfig'
import { runPlaywrightHeadlessRefresh } from './playwrightLogin'
import type { ProbeOutcome } from './stateMachine'
import type { ProbeExecutionResult } from './sessionContracts'
import type { ProbeRunner } from './probeRunner'

export class SessionRecovery {
  private readonly probeRunner: ProbeRunner
  private readonly playwrightProfileDir: string
  private readonly resolvePersistentSession: () => Session
  private lastSilentRefreshAttemptAt = 0
  private lastPlaywrightRefreshAttemptAt = 0

  constructor(options: {
    probeRunner: ProbeRunner
    playwrightProfileDir: string
    resolvePersistentSession: () => Session
  }) {
    this.probeRunner = options.probeRunner
    this.playwrightProfileDir = options.playwrightProfileDir
    this.resolvePersistentSession = options.resolvePersistentSession
  }

  resetCooldowns(): void {
    this.lastSilentRefreshAttemptAt = 0
    this.lastPlaywrightRefreshAttemptAt = 0
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

  shouldAttemptPlaywrightHeadlessRefresh(outcome: ProbeOutcome, allowRetry: boolean): boolean {
    if (!allowRetry) return false
    if (outcome.healthy) return false
    if (outcome.kind === 'network' || outcome.kind === 'challenge') return false
    if (outcome.kind !== 'login_redirect' && outcome.kind !== 'unknown') return false

    const now = Date.now()
    if (now - this.lastPlaywrightRefreshAttemptAt < PLAYWRIGHT_HEADLESS_REFRESH_COOLDOWN_MS) {
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

  async runPlaywrightHeadlessRefreshProbe(
    previousAccountHash: string | null
  ): Promise<ProbeExecutionResult | null> {
    this.lastPlaywrightRefreshAttemptAt = Date.now()

    const refreshResult = await runPlaywrightHeadlessRefresh({
      profileDir: this.playwrightProfileDir,
      timeoutMs: PLAYWRIGHT_HEADLESS_REFRESH_TIMEOUT_MS
    })

    if (!refreshResult.success) {
      return null
    }

    const targetSession = this.resolvePersistentSession()
    await importExternalCookies(targetSession, refreshResult.cookies)

    const verificationProbe = await this.probeRunner.runProbeAcrossApps({
      interactive: false,
      timeoutMs: HEALTH_TIMEOUT_MS
    })
    return {
      ...verificationProbe,
      accountHash: verificationProbe.outcome.healthy
        ? verificationProbe.accountHash || refreshResult.accountHash || previousAccountHash
        : previousAccountHash
    }
  }
}
