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

  it('records the time of the last page change, and only on a change', () => {
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

    // Same page: no navigation happened, so the timestamp must not move.
    vi.setSystemTime(now + 900)
    rerender({ page: 3 })
    expect(result.current.current).toBe(now + 500)
  })
})

// ---------------------------------------------------------------------------
// useContainerSize
// ---------------------------------------------------------------------------
describe('useContainerSize', () => {
  it('starts at {w:0, h:0} for an element the ref has not seen yet', () => {
    const ref = { current: null as HTMLDivElement | null }
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
    // The dead-zone is a single property — a sub-threshold jitter must not move
    // the quantized scale — so every shape of that jitter is driven through one
    // table instead of four near-identical tests. `base`/`baseline` vary because
    // 1200×900 and 1024×768 quantize to different scales.
    it.each([
      [
        'one pixel on the non-limiting axis',
        { w: 1200, h: 900 },
        1.14,
        [
          [1201, 900],
          [1200, 900]
        ]
      ],
      [
        'one pixel on the limiting axis',
        { w: 1200, h: 900 },
        1.14,
        [
          [1200, 901],
          [1200, 900]
        ]
      ],
      [
        'one pixel on both axes',
        { w: 1200, h: 900 },
        1.14,
        [
          [1199, 901],
          [1200, 900]
        ]
      ],
      [
        'a repeated alternating jitter in a 1024×768 window',
        { w: 1024, h: 768 },
        0.97,
        [
          [1025, 768],
          [1023, 768],
          [1024, 768],
          [1025, 768],
          [1023, 768]
        ]
      ]
    ])('absorbs %s', (_label, base, expected, sizes) => {
      const { result, rerender } = renderHook(({ cs }) => useFitScale(pageDimensions, cs), {
        initialProps: { cs: base }
      })

      expect(result.current).toBe(expected)

      for (const [w, h] of sizes) {
        rerender({ cs: { w, h } })
        expect(result.current).toBe(expected)
      }
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

    it.each([
      ['a very large container', 3840, 2160, 2.73],
      ['a very small container', 100, 100, 0.13],
      ['a 1024×768 window', 1024, 768, 0.97]
    ])('quantizes %s without overflowing', (_label, w, h, expected) => {
      // h-ratio = h/792, w-ratio = w/612; the smaller of the two, rounded to 2dp.
      const { result } = renderHook(() => useFitScale(pageDimensions, { w, h }))

      expect(result.current).toBe(expected)
    })
  })
})
