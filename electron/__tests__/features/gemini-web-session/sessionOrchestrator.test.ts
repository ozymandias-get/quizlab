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
    resetCooldowns: vi.fn(),
    schedule: vi.fn(),
    stop: vi.fn(),
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
  runPlaywrightLogin: vi.fn(),
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
    resetCooldowns = mocked.resetCooldowns
  }
  return { SessionRecovery }
})

vi.mock('../../../features/gemini-web-session/sessionMonitor', () => {
  class SessionMonitor {
    schedule = mocked.schedule
    stop = mocked.stop
  }
  return { SessionMonitor }
})

vi.mock('../../../features/gemini-web-session/sessionCookies', () => ({
  clearPersistentPartitionData: mocked.clearPersistentPartitionData,
  importExternalCookies: vi.fn()
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
    mocked.runProbeAcrossApps.mockResolvedValue({
      outcome: { healthy: true, kind: 'none' },
      accountHash: 'healthy-hash',
      timedOut: false
    })
  })

  async function createOrchestrator() {
    const { SessionOrchestrator } = await import('../../../features/gemini-web-session/sessionOrchestrator')
    return new SessionOrchestrator({
      config: { checkIntervalMs: 1000, jitterPct: 0.2, maxConsecutiveFailures: 3 },
      paths: {
        profileDir: 'C:/tmp/profile',
        playwrightProfileDir: 'C:/tmp/playwright',
        configPath: 'C:/tmp/config.json',
        lockPath: 'C:/tmp/.lock'
      },
      resolvePersistentSession: () => ({}) as never
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
    expect(result.status.state).toBe('degraded')
    expect(result.status.reasonCode).toBe('unknown')
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
    expect(result.status.state).toBe('authenticated')
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
      outcome: { healthy: true, kind: 'none' },
      accountHash: 'pw-hash',
      timedOut: false
    })
    const orchestrator = await createOrchestrator()

    const result = await orchestrator.checkNow()
    expect(mocked.runPlaywrightHeadlessRefreshProbe).toHaveBeenCalledTimes(1)
    expect(result.status.state).toBe('authenticated')
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
})
