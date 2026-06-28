/**
 * Tests for electron/features/gemini-web-session/loginFlowPolicy.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => {
  return {
    Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

vi.mock('../../../../electron/core/logger', () => ({
  Logger: mocked.Logger
}))

vi.mock('../../../../electron/features/gemini-web-session/sessionErrors', () => ({
  toErrorMessage: mocked.toErrorMessage
}))

const { LoginFlowPolicy } =
  await import('../../../../electron/features/gemini-web-session/loginFlowPolicy.js')

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

    it('writes authenticated status and takes snapshot when cookies exist', async () => {
      mocked.resolvePersistentSession.mockReturnValueOnce({
        cookies: { get: vi.fn().mockResolvedValue([{ name: 'SAPISID' }]) }
      })
      const result = await policy.openLogin()
      expect(result.success).toBe(true)
      expect(mocked.writeStatus).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'authenticated' }),
        'hash-1'
      )
      expect(mocked.snapshotRepository.writeStorageStateSnapshot).toHaveBeenCalled()
    })

    it('returns error_login_verification_failed when no cookies found', async () => {
      const result = await policy.openLogin()
      expect(result.success).toBe(false)
      expect(result.error).toBe('error_login_verification_failed')
    })

    it('releases lock in finally block', async () => {
      await policy.openLogin()
      expect(mocked.release).toHaveBeenCalled()
    })

    it('catches errors and returns login failed', async () => {
      mocked.resolvePersistentSession.mockImplementationOnce(() => {
        throw new Error('Unexpected')
      })
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
      expect(result.success).toBe(false)
      expect(result.error).toBe('error_login_verification_failed')
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
