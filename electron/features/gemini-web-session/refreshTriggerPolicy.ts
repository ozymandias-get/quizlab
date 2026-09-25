import type { GeminiWebSessionConfig, GeminiWebSessionStatus } from '@shared-core/types'

import { GOOGLE_AI_WEB_APPS } from '../../../shared/constants/googleAiWebApps.js'
import type { ProfileLock } from './profileLock.js'
import { FEATURE_ENABLED } from './sessionConfig.js'
import type { ReactiveRefreshSignal, RefreshEventEmitter } from './sessionContracts.js'
import { logSuppressedError, toErrorMessage } from './sessionErrors.js'
import type { SessionMetadataRepository } from './sessionMetadataRepository.js'
import type { SessionRecovery } from './sessionRecovery.js'
import { nowIso } from './sessionUtils.js'
import { applyProbeTransition } from './stateMachine.js'

const REACTIVE_REFRESH_DEBOUNCE_MS = 1_500
const REFRESH_FAILURE_ERROR = 'error_refresh_failed_requires_login'
const REFRESH_NETWORK_ERROR = 'refresh_network_failed'
const REFRESH_UNKNOWN_ERROR = 'refresh_unknown_failed'
const LOGIN_PATH_PATTERN =
  /^\/(servicelogin|v3\/signin(?:\/|$)|checkcookie(?:\/|$)|interactivelogin(?:\/|$)|o\/oauth2(?:\/|$))/i

interface ReactiveRequestDetails {
  statusCode?: number
  url: string
  redirectURL?: string
}

interface ReactiveWebRequest {
  onCompleted: (
    filter: { urls: string[] },
    listener: (details: ReactiveRequestDetails) => void
  ) => void
  onBeforeRedirect: (
    filter: { urls: string[] },
    listener: (details: ReactiveRequestDetails) => void
  ) => void
}

interface ReactiveSession {
  webRequest?: ReactiveWebRequest
}

export interface RefreshTriggerContext {
  metadataRepository: Pick<SessionMetadataRepository, 'readMetadata' | 'writeStatus'>
  profileLock: Pick<ProfileLock, 'acquire' | 'release'>
  recovery: Pick<
    SessionRecovery,
    'isWithinRefreshGracePeriod' | 'runSilentRefreshProbe' | 'markRefreshSuccess'
  > & {
    isWithinSilentRefreshCooldown?: () => boolean
  }
  config: GeminiWebSessionConfig
  resolvePersistentSession: () => ReactiveSession
  emitRefreshEvent: RefreshEventEmitter
  initialize: () => Promise<void>
  getActiveCheck: () => Promise<GeminiWebSessionStatus> | null
  getAbortSignal: () => AbortSignal
}

function isGoogleLoginRedirectUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    return (
      parsed.hostname.toLowerCase() === 'accounts.google.com' &&
      LOGIN_PATH_PATTERN.test(parsed.pathname)
    )
  } catch {
    return false
  }
}

function getRefreshFailureError(kind: string): string {
  if (kind === 'network') return REFRESH_NETWORK_ERROR
  if (kind === 'login_redirect' || kind === 'challenge') return REFRESH_FAILURE_ERROR
  return REFRESH_UNKNOWN_ERROR
}

export class RefreshTriggerPolicy {
  private activeRefresh: Promise<void> | null = null
  private reactiveListenersConfigured = false
  private readonly lastReactiveTriggerAtByKey = new Map<string, number>()

  constructor(private context: RefreshTriggerContext) {}

  getActiveRefresh(): Promise<void> | null {
    return this.activeRefresh
  }

  clearActiveRefresh() {
    this.activeRefresh = null
  }

  configureReactiveRefreshListeners(): void {
    if (this.reactiveListenersConfigured) return

    try {
      const targetSession = this.context.resolvePersistentSession()
      const webRequest = targetSession?.webRequest
      if (
        !webRequest ||
        typeof webRequest.onCompleted !== 'function' ||
        typeof webRequest.onBeforeRedirect !== 'function'
      ) {
        return
      }

      this.reactiveListenersConfigured = true
      const managedHostFilters = GOOGLE_AI_WEB_APPS.map((app) => `https://${app.hostname}/*`)
      const filter = {
        urls: [...managedHostFilters, 'https://accounts.google.com/*']
      }

      webRequest.onCompleted(filter, (details) => {
        if (details.statusCode !== 401 && details.statusCode !== 403) return
        void this.triggerRefresh({
          reason: details.statusCode === 401 ? 'http_401' : 'http_403',
          url: details.url,
          statusCode: details.statusCode
        }).catch((error) => {
          logSuppressedError('reactive onCompleted refresh failed', error)
        })
      })

      webRequest.onBeforeRedirect(filter, (details) => {
        const candidateUrl = details.redirectURL || details.url
        if (!isGoogleLoginRedirectUrl(candidateUrl)) return
        void this.triggerRefresh({
          reason: 'login_redirect',
          url: candidateUrl
        }).catch((error) => {
          logSuppressedError('reactive redirect refresh failed', error)
        })
      })
    } catch (error) {
      logSuppressedError('reactive refresh listener setup failed', error)
    }
  }

  async triggerRefresh(signal: ReactiveRefreshSignal): Promise<void> {
    await this.context.initialize()
    const current = await this.context.metadataRepository.readMetadata()
    if (!FEATURE_ENABLED || !current.enabled || this.context.getAbortSignal().aborted) return

    const activeCheck = this.context.getActiveCheck()
    if (activeCheck) {
      await activeCheck.catch((error) => {
        logSuppressedError('active check join failed before refresh', error)
      })
    }

    if (
      signal.reason !== 'proactive_expiry' &&
      this.context.recovery.isWithinRefreshGracePeriod() &&
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

    if (
      this.context.recovery.isWithinSilentRefreshCooldown?.() &&
      current.state !== 'reauth_required'
    ) {
      return
    }

    const debounceKey = `${signal.reason}:${signal.statusCode ?? 0}:${signal.url ?? ''}`
    const now = Date.now()
    const lastTriggeredAt = this.lastReactiveTriggerAtByKey.get(debounceKey) ?? 0
    if (now - lastTriggeredAt < REACTIVE_REFRESH_DEBOUNCE_MS) return
    this.lastReactiveTriggerAtByKey.set(debounceKey, now)

    this.activeRefresh = this.executeRefresh(signal)
    try {
      await this.activeRefresh
    } finally {
      this.activeRefresh = null
    }
  }

  private async executeRefresh(signal: ReactiveRefreshSignal): Promise<void> {
    const { profileLock, metadataRepository, recovery, config, emitRefreshEvent } = this.context
    const lock = await profileLock.acquire()
    if (!lock.ok) {
      if (lock.error === 'already_in_use') return
      throw new Error(lock.error || 'lock_error')
    }

    try {
      emitRefreshEvent({ phase: 'started', reason: signal.reason })
      const current = await metadataRepository.readMetadata()
      const result = await recovery.runSilentRefreshProbe(this.context.getAbortSignal())
      const transitioned = applyProbeTransition({
        previous: current,
        outcome: result.outcome,
        timestamp: nowIso(),
        maxConsecutiveFailures: config.maxConsecutiveFailures
      })
      const requiresLogin =
        !result.outcome.healthy &&
        (result.outcome.kind === 'login_redirect' || result.outcome.kind === 'challenge')
      const nextStatus = requiresLogin
        ? { ...transitioned, state: 'reauth_required' as const }
        : transitioned

      await metadataRepository.writeStatus(nextStatus, result.accountHash || current.accountHash)

      if (result.outcome.healthy) {
        recovery.markRefreshSuccess()
        emitRefreshEvent({ phase: 'success', reason: signal.reason })
      } else {
        emitRefreshEvent({
          phase: 'failed',
          reason: signal.reason,
          error: getRefreshFailureError(result.outcome.kind)
        })
      }
    } catch (error) {
      emitRefreshEvent({
        phase: 'failed',
        reason: signal.reason,
        error: toErrorMessage(error, REFRESH_UNKNOWN_ERROR)
      })
    } finally {
      await profileLock.release()
    }
  }
}
