import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockError = vi.fn()
vi.mock('../../core/logger.js', () => ({
  Logger: {
    error: (...args: any[]) => mockError(...args)
  }
}))

describe('appCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stores the first cleanup function and runs it exactly once, ignoring later registrations', async () => {
    // Storage, the first-wins latch and the run-once latch are one state machine;
    // three separate tests asserted the same three facts.
    const { registerCleanup, runCleanup } = await import('../../core/appCleanup.js')
    const fn1 = vi.fn().mockResolvedValue(undefined)
    const fn2 = vi.fn().mockResolvedValue(undefined)

    registerCleanup(fn1)
    registerCleanup(fn2)
    await runCleanup()
    await runCleanup()

    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).not.toHaveBeenCalled()
  })

  it('runCleanup does nothing when no cleanup registered', async () => {
    const { runCleanup } = await import('../../core/appCleanup.js')
    await expect(runCleanup()).resolves.toBeUndefined()
  })

  it('runCleanup logs error when cleanup function throws', async () => {
    const { registerCleanup, runCleanup } = await import('../../core/appCleanup.js')
    const fn = vi.fn().mockRejectedValue(new Error('cleanup failed'))
    registerCleanup(fn)
    await runCleanup()
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining('[AppCleanup] Cleanup failed:'),
      expect.any(Error)
    )
  })
})
