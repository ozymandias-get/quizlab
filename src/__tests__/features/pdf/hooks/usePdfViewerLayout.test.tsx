import {
  useContainerSize,
  useFitScale,
  useLastNavigationTime
} from '@features/pdf/ui/components/usePdfViewerLayout'

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// useLastNavigationTime
// ---------------------------------------------------------------------------
describe('useLastNavigationTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a ref with 0 initially', () => {
    const { result } = renderHook(() => useLastNavigationTime(1))
    expect(result.current.current).toBe(0)
  })

  it('updates timestamp when currentPage changes', () => {
    const now = 1_000_000
    vi.setSystemTime(now)

    const { result, rerender } = renderHook(({ page }) => useLastNavigationTime(page), {
      initialProps: { page: 1 }
    })

    expect(result.current.current).toBe(0) // unchanged yet
    rerender({ page: 2 })
    expect(result.current.current).toBe(now)

    vi.setSystemTime(now + 500)
    rerender({ page: 3 })
    expect(result.current.current).toBe(now + 500)
  })

  it('does not update when currentPage stays the same', () => {
    vi.setSystemTime(100_000)

    const { result, rerender } = renderHook(({ page }) => useLastNavigationTime(page), {
      initialProps: { page: 5 }
    })

    expect(result.current.current).toBe(0)

    vi.setSystemTime(200_000)
    rerender({ page: 5 })
    expect(result.current.current).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// useContainerSize
// ---------------------------------------------------------------------------
describe('useContainerSize', () => {
  it('returns initial {w:0, h:0}', () => {
    const ref = { current: null }
    const { result } = renderHook(() => useContainerSize(ref))
    expect(result.current).toEqual({ w: 0, h: 0 })
  })
})

// ---------------------------------------------------------------------------
// useFitScale
// ---------------------------------------------------------------------------
describe('useFitScale', () => {
  const pageDimensions = { width: 612, height: 792 } // US Letter @ 72 DPI

  it('returns null when pageDimensions is null', () => {
    const { result } = renderHook(() => useFitScale(null, { w: 1200, h: 900 }))
    expect(result.current).toBeNull()
  })

  it('returns null when container dimensions are zero', () => {
    const { result } = renderHook(() => useFitScale(pageDimensions, { w: 0, h: 900 }))
    expect(result.current).toBeNull()

    const { result: r2 } = renderHook(() => useFitScale(pageDimensions, { w: 1200, h: 0 }))
    expect(r2.current).toBeNull()
  })

  it('computes fitScale as the smaller axis ratio', () => {
    const { result } = renderHook(() => useFitScale(pageDimensions, { w: 306, h: 792 }))
    // w-ratio: 306/612 = 0.5, h-ratio: 792/792 = 1.0 → min = 0.5
    expect(result.current).toBe(0.5)
  })

  it('uses height ratio when container is relatively short', () => {
    const { result } = renderHook(() => useFitScale(pageDimensions, { w: 1200, h: 396 }))
    // w-ratio: 1200/612 ≈ 1.961, h-ratio: 396/792 = 0.5 → min = 0.5
    expect(result.current).toBe(0.5)
  })

  // -----------------------------------------------------------------------
  // Dead-zone / quantization (the core fix for Issue 4)
  // -----------------------------------------------------------------------
  describe('quantization dead-zone', () => {
    it('rounds fitScale to 1 % granularity (2 decimal places)', () => {
      const { result } = renderHook(() => useFitScale(pageDimensions, { w: 700, h: 800 }))
      // w-ratio = 700/612 ≈ 1.1438, h-ratio = 800/792 ≈ 1.0101
      // min ≈ 1.0101 → rounded to 1.01
      expect(result.current).toBe(1.01)
    })

    it('absorbs ±1px noise on the non-limiting axis (width)', () => {
      // In 1200×900 the limiting axis is height (900/792 ≈ 1.136).
      // Width noise doesn't change the min at all, so scale stays identical.
      const { result, rerender } = renderHook(({ cs }) => useFitScale(pageDimensions, cs), {
        initialProps: { cs: { w: 1200, h: 900 } }
      })

      const initial = result.current
      expect(initial).toBe(1.14)

      rerender({ cs: { w: 1201, h: 900 } })
      expect(result.current).toBe(initial)
    })

    it('absorbs ±1px noise on the limiting axis (height)', () => {
      // 900/792 ≈ 1.13636 → round → 1.14
      // 901/792 ≈ 1.13763 → round → 1.14  ← same bucket (dead-zone = 0.5 %)
      const { result, rerender } = renderHook(({ cs }) => useFitScale(pageDimensions, cs), {
        initialProps: { cs: { w: 1200, h: 900 } }
      })

      const initial = result.current
      expect(initial).toBe(1.14)

      rerender({ cs: { w: 1200, h: 901 } })
      expect(result.current).toBe(initial)
    })

    it('absorbs simultaneous ±1px noise on both axes', () => {
      const { result, rerender } = renderHook(({ cs }) => useFitScale(pageDimensions, cs), {
        initialProps: { cs: { w: 1200, h: 900 } }
      })

      const initial = result.current // 1.14
      rerender({ cs: { w: 1199, h: 901 } })
      expect(result.current).toBe(initial)
    })

    it('detects a meaningful resize (≥ ~1 % change in the limiting axis)', () => {
      // 1200×900 → scale = 1.13636 → quantized: 1.14
      const { result, rerender } = renderHook(({ cs }) => useFitScale(pageDimensions, cs), {
        initialProps: { cs: { w: 1200, h: 900 } }
      })

      expect(result.current).toBe(1.14)

      // Shrink container height 900→870 (3.3 % change).
      // New scale: 870/792 ≈ 1.09848 → quantized: 1.10
      rerender({ cs: { w: 1200, h: 870 } })

      expect(result.current).toBe(1.1)
      expect(result.current).not.toBe(1.14)
    })

    it('handles very large containers without overflow', () => {
      const { result } = renderHook(() => useFitScale(pageDimensions, { w: 3840, h: 2160 }))
      // h-ratio = 2160/792 ≈ 2.7273 → quantized: 2.73
      expect(result.current).toBe(2.73)
    })

    it('handles very small containers', () => {
      const { result } = renderHook(() => useFitScale(pageDimensions, { w: 100, h: 100 }))
      // w-ratio = 100/612 ≈ 0.1634, h-ratio = 100/792 ≈ 0.1263
      // min ≈ 0.1263 → quantized: 0.13
      expect(result.current).toBe(0.13)
    })

    it('stays stable under repeated ±1px fluctuations', () => {
      // 1024×768 → h-ratio = 768/792 ≈ 0.9697 → quantized: 0.97
      const { result, rerender } = renderHook(({ cs }) => useFitScale(pageDimensions, cs), {
        initialProps: { cs: { w: 1024, h: 768 } }
      })

      const baseline = result.current
      expect(baseline).toBe(0.97)

      for (let i = 0; i < 10; i++) {
        const offsetW = i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0
        rerender({ cs: { w: 1024 + offsetW, h: 768 } })
      }

      expect(result.current).toBe(baseline)
    })
  })
})
