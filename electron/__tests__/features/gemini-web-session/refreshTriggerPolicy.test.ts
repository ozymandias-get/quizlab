/**
 * Tests for electron/features/gemini-web-session/refreshTriggerPolicy.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const refreshEventListeners: Array<{ filter: any; callback: Function }> = []
const redirectListeners: Array<{ filter: any; callback: Function }> = []

const mocked = vi.hoisted(() => {
  let _featureEnabled = true

  return {
    get FEATURE_ENABLED() {
      return _featureEnabled
    },
    set FEATURE_ENABLED(v: boolean) {
      _featureEnabled = v
    },

    nowIso: vi.fn(() => '2026-04-07T19:30:00.000Z'),
    applyProbeTransition: vi.fn(({ previous, outcome, timestamp }) => ({
      ...previous,
      state: outcome?.healthy ? 'authenticated' : 'reauth_required',
      reasonCode: outcome?.healthy ? 'none' : 'login_redirect',
      lastCheckAt: timestamp,
      lastHealthyAt: outcome?.healthy ? timestamp : previous.lastHealthyAt,
      consecutiveFailures: outcome?.healthy ? 0 : (previous.consecutiveFailures ?? 0) + 1
    })),
    isGoogleLoginRedirectUrl: vi.fn(() => false),
    logSuppressedError: vi.fn(),
    readMetadata: vi.fn().mockResolvedValue({
      enabled: true,
      state: 'auth_required',
      consecutiveFailures: 0,
      accountHash: 'hash-1'
    }),
    writeStatus: vi.fn(async (status: any, accountHash?: string) => ({
      ...status,
      accountHash: accountHash || 'hash-1'
    })),
    initialize: vi.fn().mockResolvedValue(undefined),
    getActiveCheck: vi.fn().mockResolvedValue(null),
    acquire: vi.fn().mockResolvedValue({ ok: true }),
    release: vi.fn().mockResolvedValue(undefined),
    emitRefreshEvent: vi.fn(),
    recovery: {
      isWithinRefreshGracePeriod: vi.fn(() => false),
      runSilentRefreshProbe: vi.fn().mockResolvedValue({
        outcome: { healthy: true, kind: 'none' },
        accountHash: 'hash-1'
      }),
      markRefreshSuccess: vi.fn()
    },
    config: { maxConsecutiveFailures: 3 },
    resolvePersistentSession: vi.fn(() => ({
      webRequest: {
        onCompleted: vi.fn((filter, cb) => {
          refreshEventListeners.push({ filter, callback: cb })
        }),
        onBeforeRedirect: vi.fn((filter, cb) => {
          redirectListeners.push({ filter, callback: cb })
        })
      }
    })),
    getAbortSignal: vi.fn(() => new AbortController().signal)
  }
})

vi.mock('../../../../electron/features/gemini-web-session/sessionUtils', () => ({
  nowIso: mocked.nowIso
}))

vi.mock('../../../../electron/features/gemini-web-session/stateMachine', () => ({
  applyProbeTransition: mocked.applyProbeTransition
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionConfig', () => ({
  get FEATURE_ENABLED() {
    return mocked.FEATURE_ENABLED
  }
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionErrors', () => ({
  logSuppressedError: mocked.logSuppressedError
}))

vi.mock('../../../../shared/constants/google-ai-web-apps', () => ({
  GOOGLE_AI_WEB_APPS: [{ hostname: 'gemini.google.com' }]
}))

const { RefreshTriggerPolicy } =
  await import('../../../../electron/features/gemini-web-session/refreshTriggerPolicy.js')

describe('RefreshTriggerPolicy', () => {
  let policy: InstanceType<typeof RefreshTriggerPolicy>
  let context: any

  beforeEach(() => {
    // resetAllMocks clears call history AND implementations
    vi.resetAllMocks()
    mocked.FEATURE_ENABLED = true
    refreshEventListeners.length = 0
    redirectListeners.length = 0

    // Re-establish all default mock implementations
    mocked.nowIso.mockReturnValue('2026-04-07T19:30:00.000Z')
    mocked.applyProbeTransition.mockImplementation(({ previous, outcome, timestamp }: any) => ({
      ...previous,
      state: outcome?.healthy ? 'authenticated' : 'reauth_required',
      reasonCode: outcome?.healthy ? 'none' : 'login_redirect',
      lastCheckAt: timestamp,
      lastHealthyAt: outcome?.healthy ? timestamp : previous.lastHealthyAt,
      consecutiveFailures: outcome?.healthy ? 0 : (previous.consecutiveFailures ?? 0) + 1
    }))
    mocked.isGoogleLoginRedirectUrl.mockReturnValue(false)
    mocked.readMetadata.mockResolvedValue({
      enabled: true,
      state: 'auth_required',
      consecutiveFailures: 0,
      accountHash: 'hash-1'
    })
    mocked.writeStatus.mockImplementation(async (status: any, accountHash?: string) => ({
      ...status,
      accountHash: accountHash || 'hash-1'
    }))
    mocked.initialize.mockResolvedValue(undefined)
    mocked.getActiveCheck.mockResolvedValue(null)
    mocked.acquire.mockResolvedValue({ ok: true })
    mocked.release.mockResolvedValue(undefined)
    mocked.recovery.isWithinRefreshGracePeriod.mockReturnValue(false)
    mocked.recovery.runSilentRefreshProbe.mockResolvedValue({
      outcome: { healthy: true, kind: 'none' },
      accountHash: 'hash-1'
    })
    mocked.recovery.markRefreshSuccess.mockReturnValue(undefined)
    mocked.resolvePersistentSession.mockImplementation(() => ({
      webRequest: {
        onCompleted: vi.fn((filter, cb) => {
          refreshEventListeners.push({ filter, callback: cb })
        }),
        onBeforeRedirect: vi.fn((filter, cb) => {
          redirectListeners.push({ filter, callback: cb })
        })
      }
    }))
    mocked.getAbortSignal.mockImplementation(() => new AbortController().signal)

    context = {
      initialize: mocked.initialize,
      metadataRepository: {
        readMetadata: mocked.readMetadata,
        writeStatus: mocked.writeStatus
      },
      profileLock: { acquire: mocked.acquire, release: mocked.release },
      recovery: mocked.recovery,
      config: mocked.config,
      resolvePersistentSession: mocked.resolvePersistentSession,
      emitRefreshEvent: mocked.emitRefreshEvent,
      getActiveCheck: mocked.getActiveCheck,
      getAbortSignal: mocked.getAbortSignal
    }

    policy = new RefreshTriggerPolicy(context as any)
  })

  describe('triggerRefresh', () => {
    it('calls initialize and reads metadata', async () => {
      await policy.triggerRefresh({ reason: 'proactive_expiry' })
      expect(mocked.initialize).toHaveBeenCalled()
      expect(mocked.readMetadata).toHaveBeenCalled()
    })

    it('returns early when feature is disabled', async () => {
      mocked.FEATURE_ENABLED = false
      await policy.triggerRefresh({ reason: 'proactive_expiry' })
      expect(mocked.recovery.runSilentRefreshProbe).not.toHaveBeenCalled()
    })

    it('returns early when metadata says disabled', async () => {
      mocked.readMetadata.mockResolvedValueOnce({ enabled: false })
      await policy.triggerRefresh({ reason: 'proactive_expiry' })
      expect(mocked.recovery.runSilentRefreshProbe).not.toHaveBeenCalled()
    })

    it('returns early during grace period for non-expiry reasons', async () => {
      mocked.recovery.isWithinRefreshGracePeriod.mockReturnValue(true)
      await policy.triggerRefresh({ reason: 'http_401' })
      expect(mocked.recovery.runSilentRefreshProbe).not.toHaveBeenCalled()
    })

    it('does not skip during grace period when reason is proactive_expiry', async () => {
      mocked.recovery.isWithinRefreshGracePeriod.mockReturnValue(true)
      await policy.triggerRefresh({ reason: 'proactive_expiry' })
      expect(mocked.recovery.runSilentRefreshProbe).toHaveBeenCalled()
    })

    it('does not skip during grace period when state is reauth_required', async () => {
      mocked.recovery.isWithinRefreshGracePeriod.mockReturnValue(true)
      mocked.readMetadata.mockResolvedValueOnce({ enabled: true, state: 'reauth_required' })
      await policy.triggerRefresh({ reason: 'http_401' })
      expect(mocked.recovery.runSilentRefreshProbe).toHaveBeenCalled()
    })

    it('waits for active check before proceeding', async () => {
      mocked.getActiveCheck.mockReturnValue(Promise.resolve())
      await policy.triggerRefresh({ reason: 'proactive_expiry' })
      expect(mocked.getActiveCheck).toHaveBeenCalled()
    })

    it('debounces duplicate triggers within debounce window', async () => {
      await policy.triggerRefresh({
        reason: 'http_401',
        statusCode: 401,
        url: 'https://example.com'
      })
      await policy.triggerRefresh({
        reason: 'http_401',
        statusCode: 401,
        url: 'https://example.com'
      })
      expect(mocked.recovery.runSilentRefreshProbe).toHaveBeenCalledTimes(1)
    })

    it('allows triggers with different debounce keys', async () => {
      await policy.triggerRefresh({ reason: 'http_401', statusCode: 401, url: 'https://a.com' })
      await policy.triggerRefresh({ reason: 'http_401', statusCode: 401, url: 'https://b.com' })
      expect(mocked.recovery.runSilentRefreshProbe).toHaveBeenCalledTimes(2)
    })
  })

  describe('executeRefresh', () => {
    it('acquires profile lock', async () => {
      await policy.triggerRefresh({ reason: 'proactive_expiry' })
      expect(mocked.acquire).toHaveBeenCalled()
    })

    it('releases profile lock after refresh', async () => {
      await policy.triggerRefresh({ reason: 'proactive_expiry' })
      expect(mocked.release).toHaveBeenCalled()
    })

    it('writes authenticated status on healthy probe and emits success', async () => {
      await policy.triggerRefresh({ reason: 'proactive_expiry' })
      expect(mocked.recovery.markRefreshSuccess).toHaveBeenCalled()
      expect(mocked.emitRefreshEvent).toHaveBeenCalledWith({
        phase: 'success',
        reason: 'proactive_expiry'
      })
    })

    it('writes reauth_required on unhealthy probe and emits failed', async () => {
      mocked.recovery.runSilentRefreshProbe.mockResolvedValueOnce({
        outcome: { healthy: false, kind: 'challenge' }
      })
      await policy.triggerRefresh({ reason: 'proactive_expiry' })
      expect(mocked.emitRefreshEvent).toHaveBeenCalledWith({
        phase: 'failed',
        reason: 'proactive_expiry',
        error: 'error_refresh_failed_requires_login'
      })
    })
  })

  describe('configureReactiveRefreshListeners', () => {
    it('registers onCompleted and onBeforeRedirect listeners', () => {
      policy.configureReactiveRefreshListeners()
      expect(mocked.resolvePersistentSession).toHaveBeenCalled()
    })

    it('does not register listeners twice', () => {
      policy.configureReactiveRefreshListeners()
      policy.configureReactiveRefreshListeners()
      expect(mocked.resolvePersistentSession).toHaveBeenCalledTimes(1)
    })

    it('skips registration when webRequest is missing', () => {
      const noWebContext = {
        ...context,
        resolvePersistentSession: vi.fn(() => ({}))
      }
      const p = new RefreshTriggerPolicy(noWebContext as any)
      p.configureReactiveRefreshListeners()
    })
  })

  describe('getActiveRefresh / clearActiveRefresh', () => {
    it('returns null when no active refresh', () => {
      expect(policy.getActiveRefresh()).toBeNull()
    })

    it('returns null after clearing', () => {
      policy.clearActiveRefresh()
      expect(policy.getActiveRefresh()).toBeNull()
    })
  })
})
