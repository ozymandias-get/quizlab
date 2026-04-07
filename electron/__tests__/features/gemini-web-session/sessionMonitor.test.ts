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
})
