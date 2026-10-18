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

  // The breakpoint table IS the contract: below 760 one column, 760-1179 two,
  // 1180+ three; compact flips at 960.
  it.each([
    [0, false, 'minmax(0, 1fr)'],
    [500, true, 'minmax(0, 1fr)'],
    [700, true, 'minmax(0, 1fr)'],
    [900, true, 'repeat(2, minmax(0, 1fr))'],
    [1000, false, 'repeat(2, minmax(0, 1fr))'],
    [1200, false, 'repeat(3, minmax(0, 1fr))'],
    [1400, false, 'repeat(3, minmax(0, 1fr))']
  ])('at width %i: isCompact=%s, columns=%s', (width, isCompact, cardColumns) => {
    const ref = measureAt(width)
    const { result } = renderHook(() => useAiHomeLayout(ref))
    expect(result.current.isCompact).toBe(isCompact)
    expect(result.current.cardColumns).toBe(cardColumns)
  })
})
