import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionRecovery } from '../../../features/gemini-web-session/sessionRecovery.js'

vi.mock('../../../features/gemini-web-session/sessionCookies', () => ({
  importExternalCookies: vi.fn()
}))

describe('session recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('runs silent refresh fallback probe when signin probe fails', async () => {
    const runProbe = vi.fn().mockResolvedValueOnce({
      outcome: { healthy: false, kind: 'unknown' },
      accountHash: null,
      timedOut: false
    })
    const runProbeAcrossApps = vi.fn().mockResolvedValueOnce({
      outcome: { healthy: true, kind: 'none' },
      accountHash: 'acc',
      timedOut: false
    })
    const recovery = new SessionRecovery({
      probeRunner: { runProbe, runProbeAcrossApps } as never,
      resolvePersistentSession: () => ({}) as never
    })

    const result = await recovery.runSilentRefreshProbe()
    expect(runProbe).toHaveBeenCalledTimes(1)
    expect(runProbeAcrossApps).toHaveBeenCalledTimes(1)
    expect(result.outcome.healthy).toBe(true)
  })

  it('runAutoProfileRecovery succeeds', async () => {
    const recovery = new SessionRecovery({
      probeRunner: { runProbe: vi.fn(), runProbeAcrossApps: vi.fn() } as never,
      resolvePersistentSession: () => ({}) as never
    })

    const result = await recovery.runAutoProfileRecovery()

    expect(result.success).toBe(true)
  })

  it('shouldAttemptSilentRefresh returns false when outcome is healthy', () => {
    const recovery = new SessionRecovery({
      probeRunner: { runProbe: vi.fn(), runProbeAcrossApps: vi.fn() } as never,
      resolvePersistentSession: () => ({}) as never
    })

    const result = recovery.shouldAttemptSilentRefresh(
      { healthy: true, kind: 'none' } as never,
      true
    )

    expect(result).toBe(false)
  })

  it('shouldAttemptSilentRefresh returns false when allowRetry is false', () => {
    const recovery = new SessionRecovery({
      probeRunner: { runProbe: vi.fn(), runProbeAcrossApps: vi.fn() } as never,
      resolvePersistentSession: () => ({}) as never
    })

    const result = recovery.shouldAttemptSilentRefresh(
      { healthy: false, kind: 'unknown' } as never,
      false
    )

    expect(result).toBe(false)
  })

  it('shouldAttemptSilentRefresh returns true when conditions are met', () => {
    const recovery = new SessionRecovery({
      probeRunner: { runProbe: vi.fn(), runProbeAcrossApps: vi.fn() } as never,
      resolvePersistentSession: () => ({}) as never
    })

    const result = recovery.shouldAttemptSilentRefresh(
      { healthy: false, kind: 'login_redirect' } as never,
      true
    )

    expect(result).toBe(true)
  })

  it('markRefreshSuccess and isWithinRefreshGracePeriod work together', () => {
    const recovery = new SessionRecovery({
      probeRunner: { runProbe: vi.fn(), runProbeAcrossApps: vi.fn() } as never,
      resolvePersistentSession: () => ({}) as never
    })

    expect(recovery.isWithinRefreshGracePeriod()).toBe(false)
    recovery.markRefreshSuccess()
    expect(recovery.isWithinRefreshGracePeriod()).toBe(true)
  })

  it('resetCooldowns resets silent refresh cooldown', () => {
    const recovery = new SessionRecovery({
      probeRunner: { runProbe: vi.fn(), runProbeAcrossApps: vi.fn() } as never,
      resolvePersistentSession: () => ({}) as never
    })

    recovery.resetCooldowns()
    const result = recovery.shouldAttemptSilentRefresh(
      { healthy: false, kind: 'login_redirect' } as never,
      true
    )
    expect(result).toBe(true)
  })
})
