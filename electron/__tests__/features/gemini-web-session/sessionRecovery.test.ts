import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionRecovery } from '../../../features/gemini-web-session/sessionRecovery'

const recoveryMocks = vi.hoisted(() => ({
  runPlaywrightHeadlessRefresh: vi.fn(),
  importExternalCookies: vi.fn()
}))

vi.mock('../../../features/gemini-web-session/playwrightLogin', () => ({
  runPlaywrightHeadlessRefresh: recoveryMocks.runPlaywrightHeadlessRefresh
}))

vi.mock('../../../features/gemini-web-session/sessionCookies', () => ({
  importExternalCookies: recoveryMocks.importExternalCookies
}))

describe('session recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    recoveryMocks.runPlaywrightHeadlessRefresh.mockReset()
    recoveryMocks.importExternalCookies.mockReset().mockResolvedValue(undefined)
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
      playwrightProfileDir: 'C:/tmp/playwright',
      resolvePersistentSession: () => ({}) as never
    })

    const result = await recovery.runSilentRefreshProbe()
    expect(runProbe).toHaveBeenCalledTimes(1)
    expect(runProbeAcrossApps).toHaveBeenCalledTimes(1)
    expect(result.outcome.healthy).toBe(true)
  })

  it('imports cookies and verifies probe after playwright refresh', async () => {
    recoveryMocks.runPlaywrightHeadlessRefresh.mockResolvedValue({
      success: true,
      cookies: [{ name: 'SID', value: 'x' }],
      accountHash: 'from_refresh'
    })
    const runProbeAcrossApps = vi.fn().mockResolvedValue({
      outcome: { healthy: true, kind: 'none' },
      accountHash: null,
      timedOut: false
    })

    const recovery = new SessionRecovery({
      probeRunner: { runProbe: vi.fn(), runProbeAcrossApps } as never,
      playwrightProfileDir: 'C:/tmp/playwright',
      resolvePersistentSession: () => ({ cookies: {} }) as never
    })

    const result = await recovery.runPlaywrightHeadlessRefreshProbe('old')
    expect(recoveryMocks.runPlaywrightHeadlessRefresh).toHaveBeenCalledWith({
      profileDir: 'C:/tmp/playwright',
      timeoutMs: expect.any(Number)
    })
    expect(recoveryMocks.importExternalCookies).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(true)
    expect(result.probe?.accountHash).toBe('from_refresh')
  })

  it('propagates requires-login refresh failures without probing', async () => {
    recoveryMocks.runPlaywrightHeadlessRefresh.mockResolvedValue({
      success: false,
      error: 'error_refresh_failed_requires_login'
    })
    const runProbeAcrossApps = vi.fn()

    const recovery = new SessionRecovery({
      probeRunner: { runProbe: vi.fn(), runProbeAcrossApps } as never,
      playwrightProfileDir: 'C:/tmp/playwright',
      resolvePersistentSession: () => ({ cookies: {} }) as never
    })

    const result = await recovery.runPlaywrightHeadlessRefreshProbe('old')

    expect(result.success).toBe(false)
    expect(result.error).toBe('error_refresh_failed_requires_login')
    expect(runProbeAcrossApps).not.toHaveBeenCalled()
  })
})
