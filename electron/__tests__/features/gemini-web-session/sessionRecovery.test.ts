import type { Session } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ProbeExecutionResult,
  SessionMetadata
} from '../../../features/gemini-web-session/sessionContracts.js'
import { SessionRecovery } from '../../../features/gemini-web-session/sessionRecovery.js'

vi.mock('../../../features/gemini-web-session/sessionCookies', () => ({
  importExternalCookies: vi.fn()
}))

const session = {} as Session

function createMetadata(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    state: 'auth_required',
    reasonCode: 'unknown',
    lastCheckAt: null,
    lastHealthyAt: null,
    consecutiveFailures: 0,
    featureEnabled: true,
    enabled: true,
    enabledAppIds: ['gemini'],
    accountHash: 'hash-before',
    ...overrides
  }
}

describe('session recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('reports when automatic profile recovery is unavailable', async () => {
    const recovery = new SessionRecovery({
      resolvePersistentSession: () => session
    })

    const result = await recovery.runAutoProfileRecovery()

    expect(result).toEqual({ success: false, error: 'auto_recovery_unavailable' })
  })

  it('runs the injected probe, prepares the profile, and persists the attempt', async () => {
    const metadata = createMetadata()
    const readMetadata = vi.fn(async () => metadata)
    const writeStatus = vi.fn(async (status, accountHash) => ({ ...status, accountHash }))
    const ensureProfileDirectory = vi.fn(async () => undefined)
    const probeSession = vi.fn<
      (targetSession: Session, signal?: AbortSignal) => Promise<ProbeExecutionResult>
    >(async () => ({
      outcome: { kind: 'authenticated', healthy: true },
      accountHash: 'hash-after',
      timedOut: false
    }))
    const recovery = new SessionRecovery({
      resolvePersistentSession: () => session,
      ensureProfileDirectory,
      probeSession,
      metadataRepository: { readMetadata, writeStatus }
    })

    const result = await recovery.runSilentRefreshProbe()

    expect(result.accountHash).toBe('hash-after')
    expect(ensureProfileDirectory).toHaveBeenCalledOnce()
    expect(probeSession).toHaveBeenCalledWith(session, undefined)
    expect(writeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ lastCheckAt: expect.any(String) }),
      'hash-before',
      expect.objectContaining({ lastSilentRefreshAttemptAt: expect.any(Number) })
    )
    expect(recovery.isWithinSilentRefreshCooldown()).toBe(true)
  })

  it('does not retry login probes during the cooldown', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-07T19:30:00.000Z'))
    const recovery = new SessionRecovery({
      resolvePersistentSession: () => session,
      probeSession: async () => ({
        outcome: { kind: 'login_redirect', healthy: false },
        accountHash: null,
        timedOut: false
      })
    })

    await recovery.runSilentRefreshProbe()
    recovery.markRefreshSuccess()
    expect(recovery.isWithinRefreshGracePeriod()).toBe(true)
    expect(
      recovery.shouldAttemptSilentRefresh({ kind: 'login_redirect', healthy: false }, true)
    ).toBe(false)

    vi.setSystemTime(new Date('2026-04-07T20:00:00.000Z'))
    expect(
      recovery.shouldAttemptSilentRefresh({ kind: 'login_redirect', healthy: false }, true)
    ).toBe(true)
    expect(recovery.shouldAttemptSilentRefresh({ kind: 'challenge', healthy: false }, true)).toBe(
      false
    )
  })
})
