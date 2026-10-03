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
    debug: vi.fn(),
    error: vi.fn()
  }
}))

const { startCacheScheduler, stopCacheScheduler } = await import('@electron/core/cacheScheduler')

/** Mirrors SMART_CHECK_INTERVAL_MS in cacheScheduler.ts. */
const SMART_TICK_MS = 5 * 60 * 1000
/** Mirrors FOREGROUND_FULL_SCAN_MIN_INTERVAL_MS in cacheScheduler.ts. */
const FULL_SCAN_MIN_MS = 30 * 60 * 1000

const smartBreakdown = (total: number, level: 'normal' | 'moderate' = 'normal') => ({
  total,
  chromiumCache: 0,
  codeCache: 0,
  gpuCache: 0,
  partitionCaches: {},
  tempFiles: 0,
  pressureLevel: level,
  pressurePercentage: (total / (500 * 1024 * 1024)) * 100,
  recommendation: {
    action: 'none' as const,
    reason: 'test',
    targetPartitions: [],
    estimatedFreeBytes: 0
  },
  partitionDetails: []
})

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

    it('calls runQuickCheck on every scheduled tick', async () => {
      startCacheScheduler()
      vi.advanceTimersByTime(15 * 60 * 1000)
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()
      expect(mockRunQuickCheck.mock.calls.length).toBeGreaterThanOrEqual(1)
    })

    it('hands the already-measured total to runQuickCheck instead of re-walking', async () => {
      // runSmartForegroundCheck already measured the whole userData tree to
      // derive the pressure level. Re-measuring it inside runQuickCheck doubled
      // the recursive directory walks on every tick.
      mockMeasureSmartBreakdown.mockResolvedValueOnce({
        total: 12345,
        chromiumCache: 0,
        codeCache: 0,
        gpuCache: 0,
        partitionCaches: {},
        tempFiles: 0,
        pressureLevel: 'normal' as const,
        pressurePercentage: 0,
        recommendation: {
          action: 'none',
          reason: 'normal',
          targetPartitions: [],
          estimatedFreeBytes: 0
        },
        partitionDetails: []
      })

      startCacheScheduler()
      vi.advanceTimersByTime(SMART_TICK_MS)
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()

      expect(mockRunQuickCheck).toHaveBeenCalledWith(12345)
    })

    it('hands the already-measured total to runQuickCheck in the auto-clean branch too', async () => {
      // Moderate pressure takes the runQuickCheck() auto-clean path, which had
      // the same redundant re-walk as the normal path.
      const { shouldTriggerAutoClean } = await import('@electron/core/smartCachePolicy')
      vi.mocked(shouldTriggerAutoClean).mockReturnValueOnce(true)

      mockMeasureSmartBreakdown.mockResolvedValueOnce({
        total: 777,
        chromiumCache: 0,
        codeCache: 0,
        gpuCache: 0,
        partitionCaches: {},
        tempFiles: 0,
        pressureLevel: 'moderate' as const,
        pressurePercentage: 60,
        recommendation: {
          action: 'none',
          reason: 'moderate',
          targetPartitions: [],
          estimatedFreeBytes: 0
        },
        partitionDetails: []
      })

      startCacheScheduler()
      vi.advanceTimersByTime(SMART_TICK_MS)
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()

      expect(mockRunQuickCheck).toHaveBeenCalledWith(777)
    })

    it('drives the smart check from a single timer', async () => {
      // A 15-minute foreground timer used to call the exact same function as
      // the 5-minute smart timer, so every 15-minute boundary paid for a second
      // full tree walk. One hour must now produce exactly 12 ticks, not 12 + 4.
      startCacheScheduler()

      vi.advanceTimersByTime(60 * 60 * 1000)
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()

      expect(mockRunQuickCheck).toHaveBeenCalledTimes(12)
    })

    it('does not re-walk the whole tree on every 5-minute tick', async () => {
      // measureSmartCacheBreakdown() is a full recursive stat of Cache/Code
      // Cache/GPUCache for the root profile and all 14 AI partitions. Measured
      // at ~405 ms and ~6,000 fs calls on a 4.7k-file profile, i.e. ~6,000
      // event-loop turns inside the main process per call.
      mockMeasureSmartBreakdown.mockResolvedValue(smartBreakdown(1024))

      startCacheScheduler()
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      // 12 ticks in an hour, but only the ones that fall outside the
      // 30-minute full-scan budget actually touch the filesystem.
      expect(mockRunQuickCheck).toHaveBeenCalledTimes(12)
      expect(mockMeasureSmartBreakdown).toHaveBeenCalledTimes(2)
    })

    it('never lets two expensive full scans overlap', async () => {
      // A pathological profile can make one walk outlive the tick interval.
      // Overlapping walks would stack their fs completions on the same loop.
      let resolveFirst: ((v: ReturnType<typeof smartBreakdown>) => void) | undefined
      mockMeasureSmartBreakdown.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          })
      )

      startCacheScheduler()
      // First tick starts the walk and leaves it unresolved.
      await vi.advanceTimersByTimeAsync(SMART_TICK_MS)
      // Second tick must join the in-flight walk, not start a new one.
      await vi.advanceTimersByTimeAsync(SMART_TICK_MS)

      expect(mockMeasureSmartBreakdown).toHaveBeenCalledTimes(1)

      resolveFirst?.(smartBreakdown(2048))
      await vi.advanceTimersByTimeAsync(0)
      expect(mockRunQuickCheck.mock.calls.map((c) => c[0])).toEqual([2048, 2048])
    })

    it('reuses the cached total for the size check on skipped scans', async () => {
      mockMeasureSmartBreakdown.mockResolvedValue(smartBreakdown(4096))

      startCacheScheduler()
      await vi.advanceTimersByTimeAsync(SMART_TICK_MS)
      await vi.advanceTimersByTimeAsync(SMART_TICK_MS)

      // Second tick reused the cached measurement but still gated the size
      // check on the same total — no walk, no behaviour change.
      expect(mockMeasureSmartBreakdown).toHaveBeenCalledTimes(1)
      expect(mockRunQuickCheck.mock.calls.map((c) => c[0])).toEqual([4096, 4096])
    })

    it('takes a fresh measurement again once the full-scan budget expires', async () => {
      mockMeasureSmartBreakdown.mockResolvedValue(smartBreakdown(1))

      startCacheScheduler()
      await vi.advanceTimersByTimeAsync(FULL_SCAN_MIN_MS + SMART_TICK_MS)

      expect(mockMeasureSmartBreakdown.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('drops the cached measurement when the scheduler stops', async () => {
      mockMeasureSmartBreakdown.mockResolvedValue(smartBreakdown(7))

      startCacheScheduler()
      await vi.advanceTimersByTimeAsync(SMART_TICK_MS)
      expect(mockMeasureSmartBreakdown).toHaveBeenCalledTimes(1)

      stopCacheScheduler()
      startCacheScheduler()
      await vi.advanceTimersByTimeAsync(SMART_TICK_MS)

      expect(mockMeasureSmartBreakdown).toHaveBeenCalledTimes(2)
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
