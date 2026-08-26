/**
 * Tests for electron/core/cacheScheduler.ts
 *
 * startCacheScheduler/stopCacheScheduler set up intervals and
 * idle detection. Tests verify they wire up correctly without
 * actually running cleanup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks ---
const mockRunIdleCleanup = vi.fn().mockResolvedValue(undefined)
const mockRunQuickCheck = vi.fn().mockResolvedValue(undefined)
const mockStartIdleDetection = vi.fn()
const mockStopIdleDetection = vi.fn()
const mockMeasureSmartBreakdown = vi.fn().mockResolvedValue({
  total: 0,
  chromiumCache: 0,
  codeCache: 0,
  gpuCache: 0,
  partitionCaches: {},
  tempFiles: 0,
  pressureLevel: 'normal' as const,
  pressurePercentage: 0,
  recommendation: { action: 'none', reason: 'normal', targetPartitions: [], estimatedFreeBytes: 0 },
  partitionDetails: []
})

vi.mock('@electron/core/cacheCleanup', () => ({
  runIdleCleanup: (...args: any[]) => mockRunIdleCleanup(...args),
  runQuickCheck: (...args: any[]) => mockRunQuickCheck(...args),
  startIdleDetection: (cb: () => void) => mockStartIdleDetection(cb),
  stopIdleDetection: () => mockStopIdleDetection()
}))

vi.mock('@electron/core/cacheMonitor', () => ({
  measureSmartCacheBreakdown: (...args: any[]) => mockMeasureSmartBreakdown(...args),
  measureCacheBreakdown: vi.fn().mockResolvedValue({
    total: 0,
    chromiumCache: 0,
    codeCache: 0,
    gpuCache: 0,
    partitionCaches: {},
    tempFiles: 0
  })
}))

vi.mock('@electron/core/smartCachePolicy', async () => {
  const actual = await vi.importActual<typeof import('@electron/core/smartCachePolicy')>(
    '@electron/core/smartCachePolicy'
  )
  return {
    ...actual,
    getCachePressure: vi.fn((total: number) => ({
      level: 'normal',
      percentage: 0,
      usedBytes: total,
      limitBytes: 500 * 1024 * 1024,
      excessBytes: 0,
      shouldAutoClean: false,
      urgency: 0
    })),
    shouldTriggerAutoClean: vi.fn(() => false)
  }
})

vi.mock('@electron/core/logger', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

const { startCacheScheduler, stopCacheScheduler } = await import('@electron/core/cacheScheduler')

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  stopCacheScheduler()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('cacheScheduler', () => {
  describe('startCacheScheduler', () => {
    it('starts idle detection with a callback', () => {
      startCacheScheduler()
      expect(mockStartIdleDetection).toHaveBeenCalledTimes(1)
      expect(mockStartIdleDetection).toHaveBeenCalledWith(expect.any(Function))
    })

    it('sets up foreground interval for quick checks', async () => {
      startCacheScheduler()
      // After 15 minutes foreground check should fire (plus smart 5-min checks)
      vi.advanceTimersByTime(15 * 60 * 1000)
      // Flush pending microtasks from async smart checks
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()
      expect(mockRunQuickCheck.mock.calls.length).toBeGreaterThanOrEqual(1)
    })

    it('does not start duplicate timers on second call', () => {
      startCacheScheduler()
      startCacheScheduler()
      expect(mockStartIdleDetection).toHaveBeenCalledTimes(1)
    })

    it('calls runQuickCheck every 15 min', async () => {
      startCacheScheduler()
      vi.advanceTimersByTime(60 * 60 * 1000) // 1 hour → at least 4 foreground + smart checks
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()
      expect(mockRunQuickCheck.mock.calls.length).toBeGreaterThanOrEqual(4)
    })

    it('idle detection callback triggers runIdleCleanup', () => {
      startCacheScheduler()
      const idleCallback = mockStartIdleDetection.mock.calls[0][0]

      idleCallback()
      expect(mockRunIdleCleanup).toHaveBeenCalledTimes(1)
    })
  })

  describe('stopCacheScheduler', () => {
    it('stops idle detection', () => {
      startCacheScheduler()
      stopCacheScheduler()
      expect(mockStopIdleDetection).toHaveBeenCalled()
    })

    it('stops foreground interval', () => {
      startCacheScheduler()
      stopCacheScheduler()
      // Advance time — no more quick checks should fire
      vi.advanceTimersByTime(30 * 60 * 1000)
      const callsBefore = mockRunQuickCheck.mock.calls.length
      // The calls that happened during start are already recorded
      // After stop there should be no new calls
      vi.advanceTimersByTime(30 * 60 * 1000)
      expect(mockRunQuickCheck.mock.calls.length).toBe(callsBefore)
    })

    it('is safe to call when scheduler was never started', () => {
      expect(() => stopCacheScheduler()).not.toThrow()
    })

    it('is safe to call multiple times', () => {
      startCacheScheduler()
      stopCacheScheduler()
      expect(() => stopCacheScheduler()).not.toThrow()
    })
  })
})
