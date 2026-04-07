import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProbeRunner } from '../../../features/gemini-web-session/probeRunner'

describe('probeRunner', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns first healthy result across apps', async () => {
    const runner = new ProbeRunner({
      ensureProfileDirectory: vi.fn().mockResolvedValue(undefined),
      resolvePersistentSession: vi.fn() as never
    })
    const runProbeSpy = vi
      .spyOn(runner, 'runProbe')
      .mockResolvedValueOnce({
        outcome: { kind: 'network', healthy: false },
        accountHash: null,
        timedOut: false
      })
      .mockResolvedValueOnce({
        outcome: { kind: 'none', healthy: true },
        accountHash: 'acc',
        timedOut: false
      })

    const result = await runner.runProbeAcrossApps({
      interactive: false,
      timeoutMs: 1000,
      initialUrls: ['https://one', 'https://two']
    })

    expect(runProbeSpy).toHaveBeenCalledTimes(2)
    expect(result.outcome.healthy).toBe(true)
    expect(result.accountHash).toBe('acc')
  })

  it('returns highest severity failure when no app is healthy', async () => {
    const runner = new ProbeRunner({
      ensureProfileDirectory: vi.fn().mockResolvedValue(undefined),
      resolvePersistentSession: vi.fn() as never
    })
    vi.spyOn(runner, 'runProbe')
      .mockResolvedValueOnce({
        outcome: { kind: 'unknown', healthy: false },
        accountHash: null,
        timedOut: false
      })
      .mockResolvedValueOnce({
        outcome: { kind: 'challenge', healthy: false },
        accountHash: null,
        timedOut: false
      })
      .mockResolvedValueOnce({
        outcome: { kind: 'network', healthy: false },
        accountHash: null,
        timedOut: false
      })

    const result = await runner.runProbeAcrossApps({
      interactive: false,
      timeoutMs: 1000,
      initialUrls: ['a', 'b', 'c']
    })

    expect(result.outcome.kind).toBe('challenge')
  })
})
