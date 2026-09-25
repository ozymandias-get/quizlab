import type { GeminiWebSessionConfig, GeminiWebSessionStatus } from '@shared-core/types'
import type { RefreshTriggerContext } from '../../../../electron/features/gemini-web-session/refreshTriggerPolicy.js'
import type {
  ProbeExecutionResult,
  SessionMetadata
} from '../../../../electron/features/gemini-web-session/sessionContracts.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => {
  const completedListeners: Array<{
    filter: { urls: string[] }
    callback: (details: { statusCode?: number; url: string; redirectURL?: string }) => void
  }> = []
  const redirectListeners: Array<{
    filter: { urls: string[] }
    callback: (details: { statusCode?: number; url: string; redirectURL?: string }) => void
  }> = []

  return {
    completedListeners,
    redirectListeners,
    nowIso: vi.fn(() => '2026-04-07T19:30:00.000Z'),
    applyProbeTransition: vi.fn(
      ({
        previous,
        outcome,
        timestamp
      }: {
        previous: GeminiWebSessionStatus
        outcome: { kind: string; healthy: boolean }
        timestamp: string
        maxConsecutiveFailures: number
      }) => ({
        ...previous,
        state: outcome.healthy ? ('authenticated' as const) : ('degraded' as const),
        reasonCode: outcome.healthy ? ('none' as const) : ('login_redirect' as const),
        lastCheckAt: timestamp,
        lastHealthyAt: outcome.healthy ? timestamp : previous.lastHealthyAt,
        consecutiveFailures: outcome.healthy ? 0 : previous.consecutiveFailures + 1
      })
    ),
    readMetadata: vi.fn<() => Promise<SessionMetadata>>(async () => ({
      state: 'auth_required',
      reasonCode: 'unknown',
      lastCheckAt: null,
      lastHealthyAt: null,
      consecutiveFailures: 0,
      featureEnabled: true,
      enabled: true,
      enabledAppIds: ['gemini'],
      accountHash: 'hash-before'
    })),
    writeStatus: vi.fn(async (status: GeminiWebSessionStatus, accountHash: string | null) => ({
      ...status,
      accountHash
    })),
    initialize: vi.fn(async () => undefined),
    getActiveCheck: vi.fn<() => Promise<GeminiWebSessionStatus> | null>(() => null),
    acquire: vi.fn(async () => ({ ok: true })),
    release: vi.fn(async () => undefined),
    emitRefreshEvent: vi.fn(),
    isWithinRefreshGracePeriod: vi.fn(() => false),
    isWithinSilentRefreshCooldown: vi.fn(() => false),
    runSilentRefreshProbe: vi.fn<() => Promise<ProbeExecutionResult>>(async () => ({
      outcome: { kind: 'authenticated' as const, healthy: true },
      accountHash: 'hash-after',
      timedOut: false
    })),
    markRefreshSuccess: vi.fn(),
    getAbortSignal: vi.fn(() => new AbortController().signal),
    resolvePersistentSession: vi.fn(() => ({
      webRequest: {
        onCompleted: vi.fn(
          (
            filter: { urls: string[] },
            callback: (details: { statusCode?: number; url: string; redirectURL?: string }) => void
          ) => {
            completedListeners.push({ filter, callback })
          }
        ),
        onBeforeRedirect: vi.fn(
          (
            filter: { urls: string[] },
            callback: (details: { statusCode?: number; url: string; redirectURL?: string }) => void
          ) => {
            redirectListeners.push({ filter, callback })
          }
        )
      }
    }))
  }
})

vi.mock('../../../../electron/features/gemini-web-session/sessionUtils', () => ({
  nowIso: mocked.nowIso
}))

vi.mock('../../../../electron/features/gemini-web-session/stateMachine', () => ({
  applyProbeTransition: mocked.applyProbeTransition
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionErrors', () => ({
  logSuppressedError: vi.fn(),
  toErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback
  )
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionConfig', () => ({
  get FEATURE_ENABLED() {
    return true
  }
}))

const { RefreshTriggerPolicy } =
  await import('../../../../electron/features/gemini-web-session/refreshTriggerPolicy.js')

describe('RefreshTriggerPolicy', () => {
  let policy: InstanceType<typeof RefreshTriggerPolicy>
  let context: RefreshTriggerContext

  beforeEach(() => {
    vi.clearAllMocks()
    mocked.completedListeners.length = 0
    mocked.redirectListeners.length = 0
    mocked.nowIso.mockReturnValue('2026-04-07T19:30:00.000Z')
    mocked.applyProbeTransition.mockImplementation(({ previous, outcome, timestamp }) => ({
      ...previous,
      state: outcome.healthy ? ('authenticated' as const) : ('degraded' as const),
      reasonCode: outcome.healthy ? ('none' as const) : ('login_redirect' as const),
      lastCheckAt: timestamp,
      lastHealthyAt: outcome.healthy ? timestamp : previous.lastHealthyAt,
      consecutiveFailures: outcome.healthy ? 0 : previous.consecutiveFailures + 1
    }))
    mocked.readMetadata.mockResolvedValue({
      state: 'auth_required',
      reasonCode: 'unknown',
      lastCheckAt: null,
      lastHealthyAt: null,
      consecutiveFailures: 0,
      featureEnabled: true,
      enabled: true,
      enabledAppIds: ['gemini'],
      accountHash: 'hash-before'
    })
    mocked.writeStatus.mockImplementation(async (status, accountHash) => ({
      ...status,
      accountHash
    }))
    mocked.initialize.mockResolvedValue(undefined)
    mocked.getActiveCheck.mockReturnValue(null)
    mocked.acquire.mockResolvedValue({ ok: true })
    mocked.release.mockResolvedValue(undefined)
    mocked.emitRefreshEvent.mockClear()
    mocked.isWithinRefreshGracePeriod.mockReturnValue(false)
    mocked.isWithinSilentRefreshCooldown.mockReturnValue(false)
    mocked.runSilentRefreshProbe.mockResolvedValue({
      outcome: { kind: 'authenticated', healthy: true },
      accountHash: 'hash-after',
      timedOut: false
    })
    mocked.markRefreshSuccess.mockReturnValue(undefined)
    mocked.getAbortSignal.mockReturnValue(new AbortController().signal)
    mocked.resolvePersistentSession.mockReturnValue({
      webRequest: {
        onCompleted: vi.fn((filter, callback) => {
          mocked.completedListeners.push({ filter, callback })
        }),
        onBeforeRedirect: vi.fn((filter, callback) => {
          mocked.redirectListeners.push({ filter, callback })
        })
      }
    })

    context = {
      metadataRepository: {
        readMetadata: mocked.readMetadata,
        writeStatus: mocked.writeStatus
      },
      profileLock: {
        acquire: mocked.acquire,
        release: mocked.release
      },
      recovery: {
        isWithinRefreshGracePeriod: mocked.isWithinRefreshGracePeriod,
        isWithinSilentRefreshCooldown: mocked.isWithinSilentRefreshCooldown,
        runSilentRefreshProbe: mocked.runSilentRefreshProbe,
        markRefreshSuccess: mocked.markRefreshSuccess
      },
      config: {
        profileDir: '/tmp/profile',
        checkIntervalMs: 60_000,
        jitterPct: 0.1,
        retryDelayMs: 30_000,
        maxConsecutiveFailures: 3
      } satisfies GeminiWebSessionConfig,
      resolvePersistentSession: mocked.resolvePersistentSession,
      emitRefreshEvent: mocked.emitRefreshEvent,
      initialize: mocked.initialize,
      getActiveCheck: mocked.getActiveCheck,
      getAbortSignal: mocked.getAbortSignal
    }
    policy = new RefreshTriggerPolicy(context)
  })

  it('runs a probe, updates metadata, and emits lifecycle events', async () => {
    await policy.triggerRefresh({ reason: 'proactive_expiry' })

    expect(mocked.initialize).toHaveBeenCalledOnce()
    expect(mocked.acquire).toHaveBeenCalledOnce()
    expect(mocked.runSilentRefreshProbe).toHaveBeenCalledOnce()
    expect(mocked.writeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'authenticated', reasonCode: 'none' }),
      'hash-after'
    )
    expect(mocked.markRefreshSuccess).toHaveBeenCalledOnce()
    expect(mocked.emitRefreshEvent).toHaveBeenNthCalledWith(1, {
      phase: 'started',
      reason: 'proactive_expiry'
    })
    expect(mocked.emitRefreshEvent).toHaveBeenNthCalledWith(2, {
      phase: 'success',
      reason: 'proactive_expiry'
    })
    expect(mocked.release).toHaveBeenCalledOnce()
  })

  it('returns early when the session is disabled', async () => {
    mocked.readMetadata.mockResolvedValueOnce({
      state: 'auth_required',
      reasonCode: 'unknown',
      lastCheckAt: null,
      lastHealthyAt: null,
      consecutiveFailures: 0,
      featureEnabled: true,
      enabled: false,
      enabledAppIds: [],
      accountHash: null
    })

    await policy.triggerRefresh({ reason: 'proactive_expiry' })

    expect(mocked.acquire).not.toHaveBeenCalled()
    expect(mocked.runSilentRefreshProbe).not.toHaveBeenCalled()
  })

  it('does not refresh reactive signals during the success grace period', async () => {
    mocked.isWithinRefreshGracePeriod.mockReturnValue(true)

    await policy.triggerRefresh({ reason: 'http_401' })

    expect(mocked.runSilentRefreshProbe).not.toHaveBeenCalled()
  })

  it('does not start another refresh during the silent refresh cooldown', async () => {
    mocked.isWithinSilentRefreshCooldown.mockReturnValue(true)

    await policy.triggerRefresh({ reason: 'proactive_expiry' })

    expect(mocked.acquire).not.toHaveBeenCalled()
    expect(mocked.runSilentRefreshProbe).not.toHaveBeenCalled()
  })

  it('writes the failed transition and emits a failed event', async () => {
    mocked.runSilentRefreshProbe.mockResolvedValueOnce({
      outcome: { kind: 'login_redirect', healthy: false },
      accountHash: null,
      timedOut: false
    })

    await policy.triggerRefresh({ reason: 'http_403', statusCode: 403 })

    expect(mocked.writeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'reauth_required', reasonCode: 'login_redirect' }),
      'hash-before'
    )
    expect(mocked.emitRefreshEvent).toHaveBeenLastCalledWith({
      phase: 'failed',
      reason: 'http_403',
      error: 'error_refresh_failed_requires_login'
    })
    expect(mocked.markRefreshSuccess).not.toHaveBeenCalled()
  })

  it('releases the lock and reports probe errors', async () => {
    mocked.runSilentRefreshProbe.mockRejectedValueOnce(new Error('probe failed'))

    await policy.triggerRefresh({ reason: 'proactive_expiry' })

    expect(mocked.release).toHaveBeenCalledOnce()
    expect(mocked.emitRefreshEvent).toHaveBeenLastCalledWith({
      phase: 'failed',
      reason: 'proactive_expiry',
      error: 'probe failed'
    })
  })

  it('joins concurrent refresh requests', async () => {
    let resolveProbe: (value: ProbeExecutionResult) => void = () => undefined
    mocked.runSilentRefreshProbe.mockImplementationOnce(
      () =>
        new Promise<ProbeExecutionResult>((resolve) => {
          resolveProbe = resolve
        })
    )

    const first = policy.triggerRefresh({ reason: 'proactive_expiry' })
    await vi.waitFor(() => expect(mocked.runSilentRefreshProbe).toHaveBeenCalledOnce())
    const second = policy.triggerRefresh({
      reason: 'http_401',
      statusCode: 401,
      url: 'https://gemini.google.com'
    })

    resolveProbe({
      outcome: { kind: 'authenticated', healthy: true },
      accountHash: 'hash-after',
      timedOut: false
    })
    await Promise.all([first, second])

    expect(mocked.runSilentRefreshProbe).toHaveBeenCalledOnce()
  })

  it('registers reactive listeners once and handles 401 and login redirects', async () => {
    policy.configureReactiveRefreshListeners()
    policy.configureReactiveRefreshListeners()

    expect(mocked.resolvePersistentSession).toHaveBeenCalledOnce()
    expect(mocked.completedListeners).toHaveLength(1)
    expect(mocked.redirectListeners).toHaveLength(1)

    const trigger = vi.spyOn(policy, 'triggerRefresh').mockResolvedValue(undefined)
    mocked.completedListeners[0]?.callback({
      statusCode: 401,
      url: 'https://gemini.google.com/app'
    })
    mocked.redirectListeners[0]?.callback({
      statusCode: 302,
      url: 'https://gemini.google.com/app',
      redirectURL: 'https://accounts.google.com/v3/signin'
    })

    await vi.waitFor(() => expect(trigger).toHaveBeenCalledTimes(2))
    expect(trigger).toHaveBeenNthCalledWith(1, {
      reason: 'http_401',
      url: 'https://gemini.google.com/app',
      statusCode: 401
    })
    expect(trigger).toHaveBeenNthCalledWith(2, {
      reason: 'login_redirect',
      url: 'https://accounts.google.com/v3/signin'
    })
  })

  it('ignores login-like URLs outside Google accounts', () => {
    policy.configureReactiveRefreshListeners()
    const trigger = vi.spyOn(policy, 'triggerRefresh').mockResolvedValue(undefined)

    mocked.redirectListeners[0]?.callback({
      statusCode: 302,
      url: 'https://example.com',
      redirectURL: 'https://example.com/login'
    })

    expect(trigger).not.toHaveBeenCalled()
  })

  it('keeps active refresh state observable', () => {
    expect(policy.getActiveRefresh()).toBeNull()
    policy.clearActiveRefresh()
    expect(policy.getActiveRefresh()).toBeNull()
  })
})
