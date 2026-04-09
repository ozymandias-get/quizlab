import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => {
  const baseMetadata = {
    state: 'auth_required',
    reasonCode: 'unknown',
    lastCheckAt: null,
    lastHealthyAt: null,
    consecutiveFailures: 2,
    featureEnabled: true,
    enabled: true,
    enabledAppIds: ['gemini'],
    accountHash: 'prev-hash'
  }

  return {
    metadata: { ...baseMetadata },
    runPlaywrightLogin: vi.fn(),
    importExternalCookies: vi.fn().mockResolvedValue(undefined),
    ensureMetadata: vi.fn().mockResolvedValue(undefined),
    readMetadata: vi.fn(async () => ({ ...mocked.metadata })),
    writeStatus: vi.fn(async (status, accountHash) => ({ ...status, accountHash })),
    toPublicStatus: vi.fn((status) => ({ ...status })),
    getDisabledActionResult: vi.fn(() => null),
    acquire: vi.fn().mockResolvedValue({ ok: true }),
    release: vi.fn().mockResolvedValue(undefined),
    runProbeAcrossApps: vi.fn(),
    shouldAttemptSilentRefresh: vi.fn(() => false),
    runSilentRefreshProbe: vi.fn(),
    shouldAttemptPlaywrightHeadlessRefresh: vi.fn(() => false),
    runPlaywrightHeadlessRefreshProbe: vi.fn(),
    canAttemptHeadlessRefresh: vi.fn(() => true),
    isWithinRefreshGracePeriod: vi.fn(() => false),
    markRefreshSuccess: vi.fn(),
    resetCooldowns: vi.fn(),
    schedule: vi.fn(),
    stop: vi.fn(),
    inspectCookieExpiry: vi.fn().mockResolvedValue({
      hasRelevantCookies: true,
      hasExpiredCookie: false,
      shouldRefresh: false,
      earliestExpiry: null
    }),
    clearPersistentPartitionData: vi.fn().mockResolvedValue(undefined),
    nowIso: vi.fn(() => '2026-04-07T19:30:00.000Z'),
    mkdir: vi.fn().mockResolvedValue(undefined),
    chmod: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    applyProbeTransition: vi.fn((args) => ({
      ...args.previous,
      state: args.outcome.healthy ? 'authenticated' : 'degraded',
      reasonCode: args.outcome.kind === 'none' ? 'unknown' : args.outcome.kind,
      consecutiveFailures: args.outcome.healthy ? 0 : (args.previous.consecutiveFailures ?? 0) + 1,
      lastCheckAt: args.timestamp,
      lastHealthyAt: args.outcome.healthy ? args.timestamp : args.previous.lastHealthyAt
    })),
    createDefaultStatus: vi.fn((_featureEnabled: boolean, enabled: boolean) => ({
      state: 'auth_required',
      reasonCode: 'unknown',
      lastCheckAt: null,
      lastHealthyAt: null,
      consecutiveFailures: 0,
      featureEnabled: true,
      enabled,
      enabledAppIds: ['gemini']
    }))
  }
})

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    promises: {
      mkdir: mocked.mkdir,
      chmod: mocked.chmod,
      rm: mocked.rm
    }
  },
  promises: {
    mkdir: mocked.mkdir,
    chmod: mocked.chmod,
    rm: mocked.rm
  }
}))

vi.mock('../../../features/gemini-web-session/playwrightLogin', () => ({
  runPlaywrightLogin: mocked.runPlaywrightLogin,
  runPlaywrightHeadlessRefresh: vi.fn()
}))

vi.mock('../../../features/gemini-web-session/sessionMetadataRepository', () => {
  class SessionMetadataRepository {
    ensureMetadata = mocked.ensureMetadata
    readMetadata = mocked.readMetadata
    writeStatus = mocked.writeStatus
    toPublicStatus = mocked.toPublicStatus
    getDisabledActionResult = mocked.getDisabledActionResult
  }
  return {
    SessionMetadataRepository,
    sanitizeEnabledAppIds: (ids: string[]) => ids.filter((v) => typeof v === 'string')
  }
})

vi.mock('../../../features/gemini-web-session/profileLock', () => {
  class ProfileLock {
    acquire = mocked.acquire
    release = mocked.release
  }
  return { ProfileLock }
})

vi.mock('../../../features/gemini-web-session/probeRunner', () => {
  class ProbeRunner {
    runProbeAcrossApps = mocked.runProbeAcrossApps
  }
  return { ProbeRunner }
})

vi.mock('../../../features/gemini-web-session/sessionRecovery', () => {
  class SessionRecovery {
    shouldAttemptSilentRefresh = mocked.shouldAttemptSilentRefresh
    runSilentRefreshProbe = mocked.runSilentRefreshProbe
    shouldAttemptPlaywrightHeadlessRefresh = mocked.shouldAttemptPlaywrightHeadlessRefresh
    runPlaywrightHeadlessRefreshProbe = mocked.runPlaywrightHeadlessRefreshProbe
    canAttemptHeadlessRefresh = mocked.canAttemptHeadlessRefresh
    isWithinRefreshGracePeriod = mocked.isWithinRefreshGracePeriod
    markRefreshSuccess = mocked.markRefreshSuccess
    resetCooldowns = mocked.resetCooldowns
  }
  return { SessionRecovery }
})

vi.mock('../../../features/gemini-web-session/sessionMonitor', () => {
  class SessionMonitor {
    schedule = mocked.schedule
    stop = mocked.stop
    inspectCookieExpiry = mocked.inspectCookieExpiry
  }
  return { SessionMonitor }
})

vi.mock('../../../features/gemini-web-session/sessionCookies', () => ({
  clearPersistentPartitionData: mocked.clearPersistentPartitionData,
  importExternalCookies: mocked.importExternalCookies
}))

vi.mock('../../../features/gemini-web-session/sessionUtils', () => ({
  nowIso: mocked.nowIso
}))

vi.mock('../../../features/gemini-web-session/stateMachine', () => ({
  applyProbeTransition: mocked.applyProbeTransition,
  createDefaultStatus: mocked.createDefaultStatus
}))

describe('sessionOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.metadata = {
      state: 'auth_required',
      reasonCode: 'unknown',
      lastCheckAt: null,
      lastHealthyAt: null,
      consecutiveFailures: 2,
      featureEnabled: true,
      enabled: true,
      enabledAppIds: ['gemini'],
      accountHash: 'prev-hash'
    }
    mocked.runPlaywrightLogin.mockReset()
    mocked.importExternalCookies.mockReset().mockResolvedValue(undefined)
    mocked.inspectCookieExpiry.mockReset().mockResolvedValue({
      hasRelevantCookies: true,
      hasExpiredCookie: false,
      shouldRefresh: false,
      earliestExpiry: null
    })
    mocked.runProbeAcrossApps.mockResolvedValue({
      outcome: { healthy: true, kind: 'none' },
      accountHash: 'healthy-hash',
      timedOut: false
    })
  })

  async function createOrchestrator(resolvePersistentSession?: () => never) {
    const { SessionOrchestrator } =
      await import('../../../features/gemini-web-session/sessionOrchestrator.js')
    return new SessionOrchestrator({
      config: { checkIntervalMs: 1000, jitterPct: 0.2, maxConsecutiveFailures: 3 } as any,
      paths: {
        profileDir: 'C:/tmp/profile',
        playwrightProfileDir: 'C:/tmp/playwright',
        configPath: 'C:/tmp/config.json',
        lockPath: 'C:/tmp/.lock'
      },
      resolvePersistentSession: resolvePersistentSession || (() => ({}) as never)
    })
  }

  it('dedupes concurrent checkNow calls via activeCheck', async () => {
    mocked.metadata.enabled = false
    mocked.runProbeAcrossApps.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                outcome: { healthy: true, kind: 'none' },
                accountHash: 'same-hash',
                timedOut: false
              }),
            20
          )
        })
    )
    const orchestrator = await createOrchestrator()

    const p1 = orchestrator.checkNow()
    const p2 = orchestrator.checkNow()

    const [r1, r2] = await Promise.all([p1, p2])
    expect(mocked.acquire).toHaveBeenCalledTimes(0)
    expect(mocked.readMetadata).toHaveBeenCalled()
    expect(r1).toEqual(r2)
  })

  it('writes degraded status when lock is unavailable', async () => {
    mocked.acquire.mockResolvedValueOnce({ ok: false, error: 'already_in_use' })
    const orchestrator = await createOrchestrator()

    const result = await orchestrator.checkNow()
    expect(result.success).toBe(true)
    expect(result.status!.state).toBe('degraded')
    expect(result.status!.reasonCode).toBe('unknown')
  })

  it('uses silent refresh path when configured and healthy', async () => {
    mocked.runProbeAcrossApps.mockResolvedValueOnce({
      outcome: { healthy: false, kind: 'login_redirect' },
      accountHash: null,
      timedOut: false
    })
    mocked.shouldAttemptSilentRefresh.mockReturnValueOnce(true)
    mocked.runSilentRefreshProbe.mockResolvedValueOnce({
      outcome: { healthy: true, kind: 'none' },
      accountHash: 'silent-hash',
      timedOut: false
    })
    const orchestrator = await createOrchestrator()

    const result = await orchestrator.checkNow()
    expect(mocked.runSilentRefreshProbe).toHaveBeenCalledTimes(1)
    expect(result.status!.state).toBe('authenticated')
  })

  it('uses playwright fallback after failed silent refresh', async () => {
    mocked.runProbeAcrossApps.mockResolvedValueOnce({
      outcome: { healthy: false, kind: 'login_redirect' },
      accountHash: null,
      timedOut: false
    })
    mocked.shouldAttemptSilentRefresh.mockReturnValueOnce(true)
    mocked.runSilentRefreshProbe.mockResolvedValueOnce({
      outcome: { healthy: false, kind: 'unknown' },
      accountHash: null,
      timedOut: false
    })
    mocked.shouldAttemptPlaywrightHeadlessRefresh.mockReturnValueOnce(true)
    mocked.runPlaywrightHeadlessRefreshProbe.mockResolvedValueOnce({
      success: true,
      probe: {
        outcome: { healthy: true, kind: 'none' },
        accountHash: 'pw-hash',
        timedOut: false
      }
    })
    const orchestrator = await createOrchestrator()

    const result = await orchestrator.checkNow()
    expect(mocked.runPlaywrightHeadlessRefreshProbe).toHaveBeenCalledTimes(1)
    expect(result.status!.state).toBe('authenticated')
  })

  it('returns early from ensureAuthenticated for authenticated status', async () => {
    mocked.metadata.state = 'authenticated'
    mocked.metadata.enabled = false
    const orchestrator = await createOrchestrator()

    const result = await orchestrator.ensureAuthenticated()
    expect(result.ok).toBe(true)
    expect(mocked.runProbeAcrossApps).not.toHaveBeenCalled()
  })

  it('maps ensureAuthenticated to reauth_required and session_unavailable', async () => {
    mocked.metadata.state = 'reauth_required'
    mocked.metadata.enabled = false
    const orchestrator = await createOrchestrator()
    const reauth = await orchestrator.ensureAuthenticated()
    expect(reauth.ok).toBe(false)
    expect(reauth.error).toBe('reauth_required')

    mocked.metadata.state = 'auth_required'
    const unavailable = await orchestrator.ensureAuthenticated()
    expect(unavailable.ok).toBe(false)
    expect(unavailable.error).toBe('session_unavailable')
  })

  it('setEnabled and setEnabledApps update scheduling and sanitized ids', async () => {
    const orchestrator = await createOrchestrator()
    await orchestrator.setEnabled(true)
    expect(mocked.schedule).toHaveBeenCalled()

    await orchestrator.setEnabled(false)
    expect(mocked.stop).toHaveBeenCalled()

    await orchestrator.setEnabledApps(['gemini', 'chatgpt', 12 as never])
    expect(mocked.writeStatus).toHaveBeenCalled()
  })

  it('resetProfile clears profile and writes reset_profile_required state', async () => {
    const orchestrator = await createOrchestrator()
    const result = await orchestrator.resetProfile()
    expect(result.success).toBe(true)
    expect(mocked.clearPersistentPartitionData).toHaveBeenCalledTimes(1)
    expect(mocked.rm).toHaveBeenCalled()
    expect(mocked.resetCooldowns).toHaveBeenCalledTimes(1)
    expect(mocked.release).toHaveBeenCalled()
  })

  it('propagates exact playwright login errors from openLogin', async () => {
    mocked.metadata.enabled = false
    mocked.runPlaywrightLogin.mockResolvedValueOnce({
      success: false,
      outcome: { healthy: false, kind: 'challenge' },
      timedOut: false,
      cookies: [],
      accountHash: null,
      error: 'error_challenge_required'
    })
    const orchestrator = await createOrchestrator()

    const result = await orchestrator.openLogin()

    expect(result.success).toBe(false)
    expect(result.error).toBe('error_challenge_required')
    expect(result.status!.state).toBe('auth_required')
  })

  it('maps post-import verification failures to error_login_verification_failed', async () => {
    mocked.metadata.enabled = false
    mocked.runPlaywrightLogin.mockResolvedValueOnce({
      success: true,
      outcome: { healthy: true, kind: 'authenticated' },
      timedOut: false,
      cookies: [{ name: 'SID', value: 'cookie', domain: '.google.com', path: '/' }],
      accountHash: 'new-hash'
    })
    mocked.runProbeAcrossApps.mockResolvedValueOnce({
      outcome: { healthy: false, kind: 'unknown' },
      accountHash: null,
      timedOut: false
    })
    const orchestrator = await createOrchestrator()

    const result = await orchestrator.openLogin()

    expect(mocked.importExternalCookies).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(false)
    expect(result.error).toBe('error_login_verification_failed')
  })

  it('joins concurrent refresh triggers into one headless refresh', async () => {
    mocked.metadata.enabled = true
    mocked.runPlaywrightHeadlessRefreshProbe.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                success: true,
                probe: {
                  outcome: { healthy: true, kind: 'none' },
                  accountHash: 'pw-hash',
                  timedOut: false
                }
              }),
            20
          )
        })
    )
    const orchestrator = await createOrchestrator()

    const p1 = orchestrator.triggerRefresh({ reason: 'http_401', url: 'https://gemini.google.com' })
    const p2 = orchestrator.triggerRefresh({ reason: 'http_403', url: 'https://gemini.google.com' })

    await Promise.all([p1, p2])

    expect(mocked.runPlaywrightHeadlessRefreshProbe).toHaveBeenCalledTimes(1)
  })

  it('ignores reactive refresh signals inside the refresh grace period', async () => {
    mocked.metadata.enabled = true
    mocked.isWithinRefreshGracePeriod.mockReturnValueOnce(true)
    const orchestrator = await createOrchestrator()

    await orchestrator.triggerRefresh({ reason: 'http_401', url: 'https://gemini.google.com' })

    expect(mocked.runPlaywrightHeadlessRefreshProbe).not.toHaveBeenCalled()
  })
})
