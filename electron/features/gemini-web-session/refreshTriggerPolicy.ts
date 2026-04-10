import { nowIso } from './sessionUtils'
import { applyProbeTransition } from './stateMachine'
import { FEATURE_ENABLED } from './sessionConfig'
import { isGoogleLoginRedirectUrl } from './authHeuristics'
import { GOOGLE_AI_WEB_APPS } from '../../../shared/constants/google-ai-web-apps'
import type { Session } from 'electron'
import type {
  GeminiWebSessionConfig,
  GeminiWebSessionRefreshReason,
  GeminiWebSessionStatus
} from '@shared-core/types'
import type { ReactiveRefreshSignal, RefreshEventEmitter } from './sessionContracts'
import type { SessionMetadataRepository } from './sessionMetadataRepository'
import type { ProfileLock } from './profileLock'
import type { SessionRecovery } from './sessionRecovery'

function logSuppressedError(context: string, error: unknown): void {
  console.warn(`[GeminiWebSession] ${context}:`, error)
}

const REACTIVE_REFRESH_DEBOUNCE_MS = 1_500

export interface RefreshTriggerContext {
  metadataRepository: SessionMetadataRepository
  profileLock: ProfileLock
  recovery: SessionRecovery
  config: GeminiWebSessionConfig
  resolvePersistentSession: () => Session
  emitRefreshEvent: RefreshEventEmitter
  initialize: () => Promise<void>
  getActiveCheck: () => Promise<GeminiWebSessionStatus> | null
}

export class RefreshTriggerPolicy {
  private activeRefresh: Promise<void> | null = null
  private reactiveListenersConfigured = false
  private lastReactiveTriggerAtByKey = new Map<string, number>()

  constructor(private context: RefreshTriggerContext) {}

  getActiveRefresh(): Promise<void> | null {
    return this.activeRefresh
  }

  clearActiveRefresh() {
    this.activeRefresh = null
  }

  async triggerRefresh(signal: ReactiveRefreshSignal): Promise<void> {
    const { initialize, metadataRepository, recovery, getActiveCheck } = this.context
    await initialize()
    const current = await metadataRepository.readMetadata()
    if (!FEATURE_ENABLED || !current.enabled) return

    const activeCheckPromise = getActiveCheck()
    if (activeCheckPromise) {
      await activeCheckPromise.catch((error: unknown) => {
        logSuppressedError('active check join failed before refresh', error)
      })
    }

    if (
      signal.reason !== 'proactive_expiry' &&
      recovery.isWithinRefreshGracePeriod() &&
      current.state !== 'reauth_required'
    ) {
      return
    }

    if (this.activeRefresh) {
      await this.activeRefresh.catch((error) => {
        logSuppressedError('active refresh join failed', error)
      })
      return
    }

    if (!recovery.canAttemptHeadlessRefresh()) {
      return
    }

    const debounceKey = `${signal.reason}:${signal.statusCode || 0}:${signal.url || ''}`
    const now = Date.now()
    const lastTriggeredAt = this.lastReactiveTriggerAtByKey.get(debounceKey) || 0
    if (now - lastTriggeredAt < REACTIVE_REFRESH_DEBOUNCE_MS) {
      return
    }
    this.lastReactiveTriggerAtByKey.set(debounceKey, now)

    this.activeRefresh = this.executeRefresh(signal).finally(() => {
      this.activeRefresh = null
    })
    await this.activeRefresh
  }

  private async executeRefresh(signal: ReactiveRefreshSignal): Promise<void> {
    const { profileLock, emitRefreshEvent, metadataRepository, recovery, config } = this.context
    const lock = await profileLock.acquire()
    if (!lock.ok) {
      if (lock.error === 'already_in_use') return
      throw new Error(lock.error || 'lock_error')
    }

    emitRefreshEvent({
      phase: 'started',
      reason: signal.reason
    })

    try {
      const current = await metadataRepository.readMetadata()
      const refreshResult = await recovery.runPlaywrightHeadlessRefreshProbe(current.accountHash)

      if (refreshResult.success && refreshResult.probe?.outcome.healthy) {
        const transitioned = applyProbeTransition({
          previous: current,
          outcome: refreshResult.probe.outcome,
          timestamp: nowIso(),
          maxConsecutiveFailures: config.maxConsecutiveFailures
        })
        await metadataRepository.writeStatus(
          { ...transitioned, state: 'authenticated' },
          refreshResult.probe.accountHash || current.accountHash
        )
        recovery.markRefreshSuccess()
        emitRefreshEvent({
          phase: 'success',
          reason: signal.reason
        })
        return
      }

      const error = refreshResult.error || 'error_refresh_failed_requires_login'
      const nextState =
        error === 'error_refresh_failed_requires_login' ? 'reauth_required' : 'auth_required'
      await metadataRepository.writeStatus(
        {
          ...current,
          state: nextState,
          reasonCode:
            error === 'error_refresh_failed_requires_login' ? 'login_redirect' : current.reasonCode,
          lastCheckAt: nowIso()
        },
        current.accountHash
      )
      emitRefreshEvent({
        phase: 'failed',
        reason: signal.reason,
        error
      })
    } finally {
      await profileLock.release()
    }
  }

  configureReactiveRefreshListeners(): void {
    if (this.reactiveListenersConfigured) return
    const { resolvePersistentSession } = this.context
    const targetSession = resolvePersistentSession()
    if (
      !targetSession?.webRequest ||
      typeof targetSession.webRequest.onCompleted !== 'function' ||
      typeof targetSession.webRequest.onBeforeRedirect !== 'function'
    ) {
      return
    }

    this.reactiveListenersConfigured = true
    const managedHostFilters = GOOGLE_AI_WEB_APPS.flatMap((app) => [
      `https://${app.hostname}/*`,
      `http://${app.hostname}/*`
    ])
    const filter = {
      urls: [...managedHostFilters, 'https://accounts.google.com/*']
    }

    targetSession.webRequest.onCompleted(filter, (details) => {
      if (details.statusCode !== 401 && details.statusCode !== 403) return
      const reason: GeminiWebSessionRefreshReason =
        details.statusCode === 401 ? 'http_401' : 'http_403'
      void this.triggerRefresh({
        reason,
        url: details.url,
        statusCode: details.statusCode
      }).catch((error) => {
        logSuppressedError('reactive onCompleted refresh failed', error)
      })
    })

    targetSession.webRequest.onBeforeRedirect(filter, (details) => {
      const candidateUrl = details.redirectURL || details.url
      if (!isGoogleLoginRedirectUrl(candidateUrl)) return
      void this.triggerRefresh({
        reason: 'login_redirect',
        url: candidateUrl
      }).catch((error) => {
        logSuppressedError('reactive redirect refresh failed', error)
      })
    })
  }
}
