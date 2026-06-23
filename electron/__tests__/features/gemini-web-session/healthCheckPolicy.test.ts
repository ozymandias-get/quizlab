/**
 * Tests for electron/features/gemini-web-session/healthCheckPolicy.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => {
  let _featureEnabled = true

  return {
    get FEATURE_ENABLED() {
      return _featureEnabled
    },
    set FEATURE_ENABLED(v: boolean) {
      _featureEnabled = v
    },
    HEALTH_TIMEOUT_MS: 30_000,

    nowIso: vi.fn(() => '2026-04-07T19:30:00.000Z'),
    Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    applyProbeTransition: vi.fn(({ previous, outcome, timestamp }) => ({
      ...previous,
      state: outcome?.healthy ? 'authenticated' : 'degraded',
      reasonCode: outcome?.healthy ? 'none' : outcome?.kind || 'unknown',
      lastCheckAt: timestamp,
      lastHealthyAt: outcome?.healthy ? timestamp : previous.lastHealthyAt,
      consecutiveFailures: outcome?.healthy ? 0 : (previous.consecutiveFailures ?? 0) + 1
    })),
    readMetadata: vi.fn().mockResolvedValue({
      enabled: true,
      state: 'auth_required',
      consecutiveFailures: 0,
      lastHealthyAt: null,
      enabledAppIds: ['gemini'],
      accountHash: 'hash-1'
    }),
    toPublicStatus: vi.fn((s: any) => ({ ...s })),
    writeStatus: vi.fn(async (status: any, accountHash?: string) => ({
      ...status,
      accountHash: accountHash || 'hash-1'
    })),
    acquire: vi.fn().mockResolvedValue({ ok: true }),
    release: vi.fn().mockResolvedValue(undefined),
    runProbeAcrossApps: vi.fn().mockResolvedValue({
      outcome: { healthy: true, kind: 'none' },
      accountHash: 'hash-1'
    }),
    shouldAttemptSilentRefresh: vi.fn(() => false),
    runSilentRefreshProbe: vi.fn().mockResolvedValue({
      outcome: { healthy: true, kind: 'none' },
      accountHash: 'hash-2'
    }),
    checkProfileHealth: vi.fn().mockResolvedValue({ overallHealthy: true })
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
  },
  HEALTH_TIMEOUT_MS: mocked.HEALTH_TIMEOUT_MS
}))

vi.mock('../../../../electron/core/logger', () => ({
  Logger: mocked.Logger
}))

const { HealthCheckPolicy } =
  await import('../../../../electron/features/gemini-web-session/healthCheckPolicy')

describe('HealthCheckPolicy', () => {
  let policy: InstanceType<typeof HealthCheckPolicy>
  let context: any

  beforeEach(() => {
    vi.clearAllMocks()
    mocked.FEATURE_ENABLED = true

    context = {
      metadataRepository: {
        readMetadata: mocked.readMetadata,
        writeStatus: mocked.writeStatus,
        toPublicStatus: mocked.toPublicStatus
      },
      profileLock: { acquire: mocked.acquire, release: mocked.release },
      probeRunner: { runProbeAcrossApps: mocked.runProbeAcrossApps },
      recovery: {
        shouldAttemptSilentRefresh: mocked.shouldAttemptSilentRefresh,
        runSilentRefreshProbe: mocked.runSilentRefreshProbe
      },
      config: { maxConsecutiveFailures: 3 },
      profileHealthChecker: { checkProfileHealth: mocked.checkProfileHealth }
    }

    policy = new HealthCheckPolicy(context as any)
  })

  describe('performHealthCheck', () => {
    it('returns degraded when lock cannot be acquired', async () => {
      mocked.acquire.mockResolvedValueOnce({ ok: false, error: 'already_in_use' })
      const result = await policy.performHealthCheck({ allowRetry: false })
      expect(result.state).toBe('degraded')
      expect(result.reasonCode).toBe('unknown')
    })

    it('returns early when feature is disabled', async () => {
      mocked.FEATURE_ENABLED = false
      const result = await policy.performHealthCheck({ allowRetry: false })
      expect(result.state).not.toBe('authenticated')
    })

    it('returns early when metadata says disabled', async () => {
      mocked.readMetadata.mockResolvedValueOnce({ enabled: false, state: 'uninitialized' })
      const result = await policy.performHealthCheck({ allowRetry: false })
      expect(mocked.writeStatus).not.toHaveBeenCalled()
    })

    it('runs probe and writes healthy status on success', async () => {
      const result = await policy.performHealthCheck({ allowRetry: false })
      expect(mocked.runProbeAcrossApps).toHaveBeenCalledWith({
        interactive: false,
        timeoutMs: 30_000
      })
      expect(result.state).toBe('authenticated')
    })

    it('runs probe and writes degraded status on failure', async () => {
      mocked.runProbeAcrossApps.mockResolvedValueOnce({
        outcome: { healthy: false, kind: 'network' },
        accountHash: undefined
      })
      const result = await policy.performHealthCheck({ allowRetry: false })
      expect(result.state).toBe('degraded')
    })

    it('attempts silent refresh when recovery suggests it', async () => {
      mocked.shouldAttemptSilentRefresh.mockReturnValueOnce(true)
      mocked.runProbeAcrossApps.mockResolvedValueOnce({
        outcome: { healthy: false, kind: 'network' },
        accountHash: undefined
      })
      const result = await policy.performHealthCheck({ allowRetry: true })
      expect(mocked.runSilentRefreshProbe).toHaveBeenCalled()
      expect(result.state).toBe('authenticated')
    })

    it('runs profile health check', async () => {
      await policy.performHealthCheck({ allowRetry: false })
      expect(mocked.checkProfileHealth).toHaveBeenCalled()
    })

    it('deduplicates concurrent checks', async () => {
      const [r1, r2] = await Promise.all([
        policy.performHealthCheck({ allowRetry: false }),
        policy.performHealthCheck({ allowRetry: false })
      ])
      expect(mocked.runProbeAcrossApps).toHaveBeenCalledTimes(1)
    })
  })

  describe('getActiveCheck / clearActiveCheck', () => {
    it('returns null initially', () => {
      expect(policy.getActiveCheck()).toBeNull()
    })

    it('returns null after clearing', () => {
      policy.clearActiveCheck()
      expect(policy.getActiveCheck()).toBeNull()
    })
  })
})
