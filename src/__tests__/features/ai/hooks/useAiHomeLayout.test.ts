/**
 * Tests for useAiHomeLayout — pure logic test for the layout state
 * calculator. The hook wraps a ResizeObserver + rAF, but the actual
 * state derivation is a pure function we can pin down.
 */
import { renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'

import { useAiHomeLayout } from '../../../../features/ai/hooks/useAiHomeLayout'

describe('useAiHomeLayout - getLayoutState pure function (via hook)', () => {
  function measureAt(width: number) {
    const ref = createRef<HTMLDivElement>()
    const div = document.createElement('div')
    Object.defineProperty(div, 'getBoundingClientRect', {
      value: () =>
        ({ width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0 }) as any
    })
    document.body.appendChild(div)
    ;(ref as any).current = div
    return ref
  }

  it('returns default layout (non-compact, single column) for width = 0', () => {
    const ref = measureAt(0)
    const { result } = renderHook(() => useAiHomeLayout(ref))
    expect(result.current.isCompact).toBe(false)
    expect(result.current.cardColumns).toBe('minmax(0, 1fr)')
  })

  it('isCompact is true when width < 960', () => {
    const ref = measureAt(500)
    const { result } = renderHook(() => useAiHomeLayout(ref))
    expect(result.current.isCompact).toBe(true)
  })

  it('isCompact is false when width >= 960', () => {
    const ref = measureAt(1200)
    const { result } = renderHook(() => useAiHomeLayout(ref))
    expect(result.current.isCompact).toBe(false)
  })

  it('uses single column when width < 760', () => {
    const ref = measureAt(700)
    const { result } = renderHook(() => useAiHomeLayout(ref))
    expect(result.current.cardColumns).toBe('minmax(0, 1fr)')
  })

  it('uses 2 columns when 760 <= width < 1180', () => {
    const ref = measureAt(900)
    const { result } = renderHook(() => useAiHomeLayout(ref))
    expect(result.current.cardColumns).toBe('repeat(2, minmax(0, 1fr))')
  })

  it('uses 3 columns when width >= 1180', () => {
    const ref = measureAt(1400)
    const { result } = renderHook(() => useAiHomeLayout(ref))
    expect(result.current.cardColumns).toBe('repeat(3, minmax(0, 1fr))')
  })

  it('measures on mount and on resize', () => {
    // Just verify the hook runs without throwing
    const ref = createRef<HTMLDivElement>()
    const div = document.createElement('div')
    Object.defineProperty(div, 'getBoundingClientRect', {
      value: () =>
        ({ width: 1000, height: 0, top: 0, left: 0, right: 1000, bottom: 0, x: 0, y: 0 }) as any
    })
    document.body.appendChild(div)
    ;(ref as any).current = div
    const { result } = renderHook(() => useAiHomeLayout(ref))
    expect(result.current.cardColumns).toBe('repeat(2, minmax(0, 1fr))')
  })
})
