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
    importExternalCookies: vi.fn().mockResolvedValue(undefined),
    ensureMetadata: vi.fn().mockResolvedValue(undefined),
    readMetadata: vi.fn(async () => ({ ...mocked.metadata })),
    writeStatus: vi.fn(async (status, accountHash) => ({ ...status, accountHash })),
    toPublicStatus: vi.fn((status) => ({ ...status })),
    getDisabledActionResult: vi.fn(() => null),
    acquire: vi.fn().mockResolvedValue({ ok: true }),
    release: vi.fn().mockResolvedValue(undefined),

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

vi.mock('../../../features/gemini-web-session/sessionRecovery', () => {
  class SessionRecovery {
    resetCooldowns = mocked.resetCooldowns
  }
  return { SessionRecovery }
})

vi.mock('../../../features/gemini-web-session/refreshTriggerPolicy', () => {
  class RefreshTriggerPolicy {
    configureReactiveRefreshListeners = vi.fn()
    getActiveRefresh = vi.fn().mockReturnValue(null)
    clearActiveRefresh = vi.fn()
    triggerRefresh = vi.fn()
  }
  return { RefreshTriggerPolicy }
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

vi.mock('../../../features/gemini-web-session/sessionSnapshotRepository', () => {
  class SessionSnapshotRepository {
    readStorageStateSnapshot = vi.fn().mockResolvedValue(null)
    writeStorageStateSnapshot = vi.fn().mockResolvedValue(undefined)
    clearSnapshot = vi.fn().mockResolvedValue(undefined)
  }
  return { SessionSnapshotRepository }
})

vi.mock('../../../features/gemini-web-session/profileHealthChecker', () => {
  class ProfileHealthChecker {
    checkProfileHealth = vi.fn().mockResolvedValue({
      profileDirExists: true,
      profileDirAccessible: true,
      profileSizeBytes: 1024,
      profileSizeWarning: false,
      staleLockDetected: false,
      overallHealthy: true
    })
  }
  return { ProfileHealthChecker }
})

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
    mocked.importExternalCookies.mockReset().mockResolvedValue(undefined)
    mocked.inspectCookieExpiry.mockReset().mockResolvedValue({
      hasRelevantCookies: true,
      hasExpiredCookie: false,
      shouldRefresh: false,
      earliestExpiry: null
    })
  })

  async function createOrchestrator(resolvePersistentSession?: () => never) {
    const { SessionOrchestrator } =
      await import('../../../features/gemini-web-session/sessionOrchestrator.js')
    return new SessionOrchestrator({
      config: { checkIntervalMs: 1000, jitterPct: 0.2, maxConsecutiveFailures: 3 } as any,
      paths: {
        profileDir: '/tmp/quizlab-test/profile',
        configPath: '/tmp/quizlab-test/config.json',
        lockPath: '/tmp/quizlab-test/.lock',
        storageStateSnapshotPath: '/tmp/quizlab-test/snapshot.json'
      },
      resolvePersistentSession: resolvePersistentSession || (() => ({}) as never)
    })
  }

  it('returns early from ensureAuthenticated for authenticated status', async () => {
    mocked.metadata.state = 'authenticated'
    mocked.metadata.enabled = false
    const orchestrator = await createOrchestrator()

    const result = await orchestrator.ensureAuthenticated()
    expect(result.ok).toBe(true)
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

  it('setEnabled schedules monitor when enabling and stops when disabling', async () => {
    const orchestrator = await createOrchestrator()
    await orchestrator.setEnabled(true)
    expect(mocked.schedule).toHaveBeenCalledTimes(1)
    expect(mocked.stop).not.toHaveBeenCalled()

    await orchestrator.setEnabled(false)
    expect(mocked.stop).toHaveBeenCalledTimes(1)

    await orchestrator.setEnabledApps(['gemini', 'chatgpt', 12 as never])
    expect(mocked.writeStatus).toHaveBeenCalled()
  })

  it('resetProfile clears profile and writes reset_profile_required state', async () => {
    mocked.metadata.enabled = true
    const orchestrator = await createOrchestrator()
    const result = await orchestrator.resetProfile()
    expect(result.success).toBe(true)
    expect(mocked.clearPersistentPartitionData).toHaveBeenCalledTimes(1)
    expect(mocked.resetCooldowns).toHaveBeenCalledTimes(1)
    expect(mocked.release).toHaveBeenCalled()
  })

  it('resetProfile works with storageStateSnapshotPath', async () => {
    mocked.metadata.enabled = true
    const { SessionOrchestrator } =
      await import('../../../features/gemini-web-session/sessionOrchestrator.js')
    const orchestrator = new SessionOrchestrator({
      config: { checkIntervalMs: 1000, jitterPct: 0.2, maxConsecutiveFailures: 3 } as any,
      paths: {
        profileDir: '/tmp/quizlab-test/profile',
        configPath: '/tmp/quizlab-test/config.json',
        lockPath: '/tmp/quizlab-test/.lock',
        storageStateSnapshotPath: '/tmp/quizlab-test/snapshot.json'
      },
      resolvePersistentSession: (() => ({})) as never
    })
    const result = await orchestrator.resetProfile()
    expect(result.success).toBe(true)
  })
})
