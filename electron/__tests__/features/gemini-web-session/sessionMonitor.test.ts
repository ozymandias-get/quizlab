import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionMonitor } from '../../../features/gemini-web-session/sessionMonitor'

describe('session monitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('runs scheduled callback with jittered delay', async () => {
    const monitor = new SessionMonitor()
    const callback = vi.fn().mockResolvedValue(undefined)

    monitor.schedule(1000, 10, callback)
    await vi.advanceTimersByTimeAsync(899)
    expect(callback).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('stops pending timer', async () => {
    const monitor = new SessionMonitor()
    const callback = vi.fn().mockResolvedValue(undefined)

    monitor.schedule(1000, 10, callback)
    monitor.stop()
    await vi.advanceTimersByTimeAsync(1000)

    expect(callback).not.toHaveBeenCalled()
  })

  it('detects cookie expiry risk within threshold', async () => {
    vi.setSystemTime(new Date('2026-04-08T10:00:00.000Z'))
    const monitor = new SessionMonitor()
    const targetSession = {
      cookies: {
        get: vi.fn().mockResolvedValue([
          {
            name: 'SID',
            domain: '.google.com',
            expirationDate: Date.now() / 1000 + 120
          }
        ])
      }
    }

    const result = await monitor.inspectCookieExpiry(targetSession as never, 5 * 60 * 1000)

    expect(result.shouldRefresh).toBe(true)
    expect(result.hasRelevantCookies).toBe(true)
  })

  it('does not refresh when relevant cookies are healthy and far from expiry', async () => {
    vi.setSystemTime(new Date('2026-04-08T10:00:00.000Z'))
    const monitor = new SessionMonitor()
    const targetSession = {
      cookies: {
        get: vi.fn().mockResolvedValue([
          {
            name: 'SID',
            domain: '.google.com',
            expirationDate: Date.now() / 1000 + 4 * 60 * 60
          }
        ])
      }
    }

    const result = await monitor.inspectCookieExpiry(targetSession as never, 5 * 60 * 1000)

    expect(result.shouldRefresh).toBe(false)
    expect(result.earliestExpiry).not.toBeNull()
  })
})
