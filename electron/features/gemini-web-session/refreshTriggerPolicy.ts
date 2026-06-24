import type {
  GeminiWebSessionConfig,
  GeminiWebSessionRefreshReason,
  GeminiWebSessionStatus
} from '@shared-core/types'

import type { Session } from 'electron'

import { GOOGLE_AI_WEB_APPS } from '../../../shared/constants/google-ai-web-apps.js'
import { isGoogleLoginRedirectUrl } from './authHeuristics.js'
import type { ProfileLock } from './profileLock.js'
import { FEATURE_ENABLED } from './sessionConfig.js'
import type { ReactiveRefreshSignal, RefreshEventEmitter } from './sessionContracts.js'
import { logSuppressedError } from './sessionErrors.js'
import type { SessionMetadataRepository } from './sessionMetadataRepository.js'
import type { SessionRecovery } from './sessionRecovery.js'
import { nowIso } from './sessionUtils.js'
import { applyProbeTransition } from './stateMachine.js'

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
  getAbortSignal: () => AbortSignal
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
    const { profileLock, emitRefreshEvent, metadataRepository, recovery, config, getAbortSignal } =
      this.context
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

      const refreshResult = await recovery.runSilentRefreshProbe()

      if (refreshResult.outcome.healthy) {
        const transitioned = applyProbeTransition({
          previous: current,
          outcome: refreshResult.outcome,
          timestamp: nowIso(),
          maxConsecutiveFailures: config.maxConsecutiveFailures
        })
        await metadataRepository.writeStatus(
          { ...transitioned, state: 'authenticated' },
          refreshResult.accountHash || current.accountHash
        )
        recovery.markRefreshSuccess()
        emitRefreshEvent({
          phase: 'success',
          reason: signal.reason
        })
        return
      }

      const error = 'error_refresh_failed_requires_login'
      await metadataRepository.writeStatus(
        {
          ...current,
          state: 'reauth_required',
          reasonCode: 'login_redirect',
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
