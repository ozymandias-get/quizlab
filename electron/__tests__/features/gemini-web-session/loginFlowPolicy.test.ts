/**
 * Tests for electron/features/gemini-web-session/loginFlowPolicy.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => {
  return {
    nowIso: vi.fn(() => '2026-04-07T19:30:00.000Z'),
    HEALTH_TIMEOUT_MS: 30_000,
    Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    applyProbeTransition: vi.fn(({ previous, outcome, timestamp }) => ({
      ...previous,
      state: outcome?.healthy ? 'authenticated' : 'auth_required',
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
    writeStatus: vi.fn(async (status: any, accountHash?: string) => ({
      ...status,
      accountHash: accountHash || 'hash-1'
    })),
    getDisabledActionResult: vi.fn((): any => null),
    acquire: vi.fn().mockResolvedValue({ ok: true }),
    release: vi.fn().mockResolvedValue(undefined),
    runProbeAcrossApps: vi.fn().mockResolvedValue({
      outcome: { healthy: true, kind: 'none' },
      accountHash: 'hash-1'
    }),
    initialize: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({ state: 'auth_required' }),
    snapshotRepository: {
      writeStorageStateSnapshot: vi.fn().mockResolvedValue(undefined)
    },
    resolvePersistentSession: vi.fn(() => ({
      cookies: { get: vi.fn().mockResolvedValue([]) }
    })),
    getAbortSignal: vi.fn(() => new AbortController().signal),
    toErrorMessage: vi.fn((_: unknown, fallback: string) => fallback)
  }
})

vi.mock('../../../../electron/features/gemini-web-session/sessionUtils', () => ({
  nowIso: mocked.nowIso
}))

vi.mock('../../../../electron/features/gemini-web-session/stateMachine', () => ({
  applyProbeTransition: mocked.applyProbeTransition
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionConfig', () => ({
  HEALTH_TIMEOUT_MS: mocked.HEALTH_TIMEOUT_MS
}))

vi.mock('../../../../electron/core/logger', () => ({
  Logger: mocked.Logger
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionErrors', () => ({
  toErrorMessage: mocked.toErrorMessage
}))

const { LoginFlowPolicy } =
  await import('../../../../electron/features/gemini-web-session/loginFlowPolicy')

describe('LoginFlowPolicy', () => {
  let policy: InstanceType<typeof LoginFlowPolicy>
  let context: any

  beforeEach(() => {
    vi.clearAllMocks()

    context = {
      initialize: mocked.initialize,
      metadataRepository: {
        readMetadata: mocked.readMetadata,
        writeStatus: mocked.writeStatus,
        getDisabledActionResult: mocked.getDisabledActionResult
      },
      profileLock: { acquire: mocked.acquire, release: mocked.release },
      probeRunner: { runProbeAcrossApps: mocked.runProbeAcrossApps },
      config: { maxConsecutiveFailures: 3 },
      resolvePersistentSession: mocked.resolvePersistentSession,
      getStatus: mocked.getStatus,
      snapshotRepository: mocked.snapshotRepository,
      getAbortSignal: mocked.getAbortSignal
    }

    policy = new LoginFlowPolicy(context as any)
  })

  describe('openLogin', () => {
    it('calls initialize and reads metadata', async () => {
      mocked.runProbeAcrossApps.mockResolvedValueOnce({
        outcome: { healthy: false, kind: 'network' }
      })
      await policy.openLogin()
      expect(mocked.initialize).toHaveBeenCalled()
      expect(mocked.readMetadata).toHaveBeenCalled()
    })

    it('returns blocked result when feature is disabled', async () => {
      mocked.getDisabledActionResult.mockReturnValueOnce({
        success: false,
        error: 'feature_disabled',
        status: { state: 'uninitialized' }
      })
      const result = await policy.openLogin()
      expect(result.success).toBe(false)
      expect(result.error).toBe('feature_disabled')
    })

    it('returns error when lock cannot be acquired', async () => {
      mocked.acquire.mockResolvedValueOnce({ ok: false, error: 'already_in_use' })
      const result = await policy.openLogin()
      expect(result.success).toBe(false)
      expect(result.error).toBe('already_in_use')
    })

    it('writes authenticated status and takes snapshot on healthy probe', async () => {
      const result = await policy.openLogin()
      expect(result.success).toBe(true)
      expect(mocked.writeStatus).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'authenticated' }),
        'hash-1'
      )
      expect(mocked.snapshotRepository.writeStorageStateSnapshot).toHaveBeenCalled()
    })

    it('writes auth_required on challenge probe', async () => {
      mocked.runProbeAcrossApps.mockResolvedValueOnce({
        outcome: { healthy: false, kind: 'challenge' }
      })
      const result = await policy.openLogin()
      expect(result.success).toBe(false)
      expect(result.error).toBe('error_challenge_required')
    })

    it('writes auth_required on network probe failure', async () => {
      mocked.runProbeAcrossApps.mockResolvedValueOnce({
        outcome: { healthy: false, kind: 'network' }
      })
      const result = await policy.openLogin()
      expect(result.success).toBe(false)
      expect(result.error).toBe('error_network_login_failed')
    })

    it('reports timeout when probe timed out', async () => {
      mocked.runProbeAcrossApps.mockResolvedValueOnce({
        outcome: { healthy: false, kind: 'none' },
        timedOut: true
      })
      const result = await policy.openLogin()
      expect(result.success).toBe(false)
      expect(result.error).toBe('error_login_timeout')
    })

    it('releases lock in finally block', async () => {
      await policy.openLogin()
      expect(mocked.release).toHaveBeenCalled()
    })

    it('catches errors and returns login failed', async () => {
      mocked.runProbeAcrossApps.mockRejectedValueOnce(new Error('Unexpected'))
      const result = await policy.openLogin()
      expect(result.success).toBe(false)
      expect(result.error).toBe('error_login_failed')
    })
  })

  describe('reauthenticate', () => {
    it('writes auth_required state and calls openLogin', async () => {
      const result = await policy.reauthenticate()
      expect(mocked.writeStatus).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'auth_required', reasonCode: 'login_redirect' }),
        'hash-1'
      )
      expect(result.success).toBe(true)
    })

    it('returns blocked when feature is disabled', async () => {
      mocked.getDisabledActionResult.mockReturnValueOnce({
        success: false,
        error: 'feature_disabled',
        status: { state: 'uninitialized' }
      })
      const result = await policy.reauthenticate()
      expect(result.success).toBe(false)
      expect(result.error).toBe('feature_disabled')
    })
  })
})
